import { commentOnce, escapeMarkdown, mention } from "./common.mjs";

export const CODEX_BOT = "chatgpt-codex-connector[bot]";

export function priority(body = "") {
  const priorities = [...body.matchAll(/(?:!\[P([0-3]) Badge\]|\[P([0-3])\])/g)]
    .map((match) => Number(match[1] ?? match[2]));
  return priorities.length ? Math.min(...priorities) : null;
}

export function reviewFailed(body = "") {
  return /\b(error|failed|failure|unable|cannot|can't|could not|couldn't|quota|rate.?limit|usage limits?|reached[^\n.]*limit|not connected|not authorized|not configured|timed out|unavailable)\b/i.test(body);
}

export async function notifyCodexFromRun(args) {
  const { github, context, core, botLogin = CODEX_BOT } = args;
  const run = context.payload.workflow_run;
  if (!["pull_request_review", "pull_request_review_comment"].includes(run.event) || run.conclusion !== "success") return;
  const references = run.pull_requests?.length ? run.pull_requests :
    await github.paginate(github.rest.repos.listPullRequestsAssociatedWithCommit, {
      ...context.repo, commit_sha: run.head_sha, per_page: 100,
    });
  for (const reference of references) {
    const { data: pr } = await github.rest.pulls.get({ ...context.repo, pull_number: reference.number });
    if (pr.state !== "open" || (pr.head.sha !== run.head_sha && pr.merge_commit_sha !== run.head_sha)) {
      core.info("Událost review se týká uzavřeného PR nebo staršího commitu.");
      continue;
    }
    // Načítáme původní zprávy z GitHub API, nikoli artefakty či skripty PR.
    const reviews = await github.paginate(github.rest.pulls.listReviews, {
      ...context.repo, pull_number: pr.number, per_page: 100,
    });
    const comments = await github.paginate(github.rest.pulls.listReviewComments, {
      ...context.repo, pull_number: pr.number, per_page: 100,
    });
    for (const [kind, sources] of [["review", reviews], ["comment", comments]]) {
      for (const source of sources.filter((entry) => entry.user?.login === botLogin && entry.user.type === "Bot")) {
        await notifyCodex({ ...args, context: { ...context,
          payload: { pull_request: { number: pr.number }, [kind]: source } } });
      }
    }
  }
}

export async function notifyCodex({ github, context, core, notifyUser, botLogin = CODEX_BOT }) {
  const payload = context.payload;
  const source = payload.review ?? payload.comment;
  if (source?.user?.login !== botLogin || source.user.type !== "Bot") return;
  if (source.in_reply_to_id) return;
  const number = payload.pull_request?.number ?? (payload.issue?.pull_request && payload.issue.number);
  if (!number) return;

  const repo = context.repo;
  const { data: pr } = await github.rest.pulls.get({ ...repo, pull_number: number });
  if (pr.state !== "open") return;
  const reviewedSha = source.commit_id ?? /Reviewed commit:\s*`?([a-f\d]{7,40})/i.exec(source.body ?? "")?.[1];
  if (reviewedSha && !pr.head.sha.startsWith(reviewedSha)) {
    core.info("Codex komentoval starší commit; nový PR tím neoznačujeme za neúspěšný.");
    return;
  }

  let findings = [];
  if (payload.review) {
    const comments = await github.paginate(github.rest.pulls.listCommentsForReview, {
      ...repo, pull_number: number, review_id: source.id, per_page: 100,
    });
    findings = comments.filter((comment) => comment.user?.login === botLogin &&
      comment.user.type === "Bot" && !comment.in_reply_to_id &&
      (!comment.commit_id || comment.commit_id === pr.head.sha) && priority(comment.body) !== 3);
  } else if (source.path && priority(source.body) !== 3) {
    findings = [source];
  }
  const sourcePriority = priority(source.body);
  const failed = !findings.length && sourcePriority === null && reviewFailed(source.body);
  const changesRequested = source.state?.toLowerCase() === "changes_requested";
  if (!findings.length && !failed && !changesRequested && (sourcePriority === null || sourcePriority === 3)) return;

  // Inline komentáře a následné submitted review sdílí klíč. Jeden review
  // proto upozorní jen jednou; nové review nebo nová provozní chyba upozorní znovu.
  const reviewId = payload.review?.id ?? source.pull_request_review_id;
  const marker = `<!-- fakturka-codex:${reviewId ? `review:${reviewId}` : `comment:${source.id}`} -->`;
  const lines = [
    failed ? `${mention(notifyUser)}, **Codex review se nepodařilo dokončit**.` :
      `${mention(notifyUser)}, **Codex code review má připomínky k úpravě**.`,
    "", `PR #${number} · aktuální commit \`${pr.head.sha}\``, "",
  ];
  if (failed) {
    lines.push(escapeMarkdown((source.body ?? "").slice(0, 1200)), "",
      "Zkontroluj propojení Codexu, oprávnění a dostupný limit. Po vyřešení vyžádej nové review.");
  } else {
    for (const finding of findings.slice(0, 20)) {
      const level = priority(finding.body);
      const location = `${finding.path}${finding.line ? `:${finding.line}` : ""}`;
      lines.push(`- [${level === null ? "Připomínka" : `P${level}`} — ${escapeMarkdown(location)}](${finding.html_url})`);
    }
    lines.push("", "Otevři připomínky Codexu, oprav popsanou příčinu a pošli nový commit. Potom nechej znovu proběhnout kontroly a review.");
  }
  lines.push("", `[Otevřít původní review nebo zprávu](${source.html_url})`);
  await commentOnce({ github, repo, number, marker, body: lines.join("\n") });
}
