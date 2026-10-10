import { commentOnce, escapeMarkdown, FAILED, isOwnMessage, mention } from "./common.mjs";

function correction(stepName) {
  const commands = {
    ESLint: "npm run lint",
    TypeScript: "npm run typecheck",
    Testy: "npm test",
    "Testy agentů a notifikací": "npm run test:agents",
    "Integrační testy": "npm run test:integration (s PostgreSQL)",
    "Produkční build": "npm run build",
    "Generovat Prisma klienta": "npm run prisma:generate",
    "Instalace závislostí": "npm ci",
  };
  return commands[stepName] ? ` — ověř lokálně: \`${commands[stepName]}\`` : "";
}

export function formatCiFailure({ run, jobs, notifyUser }) {
  const lines = [
    `${mention(notifyUser)}, kontroly projektu selhaly a je potřeba zásah.`,
    "",
    `Workflow: **${escapeMarkdown(run.name)}**`,
    `Commit: \`${run.head_sha}\` · pokus ${run.run_attempt}`,
    "",
  ];
  for (const job of jobs.filter((entry) => FAILED.has(entry.conclusion))) {
    lines.push(`- **${escapeMarkdown(job.name)}** (${escapeMarkdown(job.conclusion)})`);
    for (const step of (job.steps ?? []).filter((entry) => FAILED.has(entry.conclusion))) {
      lines.push(`  - ${escapeMarkdown(step.name)}${correction(step.name)}`);
    }
  }
  lines.push("", `[Otevřít logy a neúspěšné kroky](${run.html_url})`, "",
    "Oprav příčinu uvedenou v logu a pošli nový commit, případně zopakuj kontrolu po odstranění provozní chyby.");
  return lines.join("\n");
}

async function notifyBranch({ github, repo, run, body, marker }) {
  const branchMarker = `<!-- fakturka-ci-branch:${run.workflow_id}:${run.event}:${run.head_branch} -->`;
  const issues = await github.paginate(github.rest.issues.listForRepo, {
    ...repo, state: "open", creator: "github-actions[bot]", per_page: 100,
  });
  const issue = issues.find((entry) => !entry.pull_request && isOwnMessage(entry) && entry.body?.includes(branchMarker));

  if (run.conclusion === "success") {
    if (issue) {
      await commentOnce({ github, repo, number: issue.number, marker,
        body: `Kontroly nového commitu \`${run.head_sha}\` prošly. [Úspěšný běh](${run.html_url}).` });
      await github.rest.issues.update({ ...repo, issue_number: issue.number,
        state: "closed", state_reason: "completed" });
    }
    return;
  }
  if (issue) {
    if (!issue.body.includes(marker)) {
      await commentOnce({ github, repo, number: issue.number, marker, body });
    }
  } else {
    await github.rest.issues.create({ ...repo,
      title: `[Agenti] CI selhalo na ${run.head_branch}`,
      body: `${body}\n\n${branchMarker}\n${marker}` });
  }
}

export async function notifyCi({ github, context, core, notifyUser }) {
  const run = context.payload.workflow_run;
  const repo = context.repo;
  if (!FAILED.has(run.conclusion) && run.conclusion !== "success") {
    core.info("Zrušený nebo neutrální běh nevyžaduje upozornění.");
    return;
  }
  const { data: currentRun } = await github.rest.actions.getWorkflowRun({ ...repo, run_id: run.id });
  if (currentRun.run_attempt !== run.run_attempt) {
    core.info("Výsledek pochází ze staršího pokusu stejného běhu.");
    return;
  }
  const marker = `<!-- fakturka-ci-run:${run.id}:${run.run_attempt} -->`;

  if (run.event === "push" || run.event === "workflow_dispatch") {
    const branch = context.payload.repository.default_branch;
    if (run.head_branch !== branch) return;
    const { data: ref } = await github.rest.git.getRef({ ...repo, ref: `heads/${branch}` });
    if (ref.object.sha !== run.head_sha) {
      core.info("Hlavní větev už obsahuje novější commit.");
      return;
    }
    const jobs = FAILED.has(run.conclusion) ? await github.paginate(github.rest.actions.listJobsForWorkflowRun, {
      ...repo, run_id: run.id, filter: "latest", per_page: 100,
    }) : [];
    await notifyBranch({ github, repo, run, marker,
      body: FAILED.has(run.conclusion) ? formatCiFailure({ run, jobs, notifyUser }) : "" });
    return;
  }
  if (run.event !== "pull_request" || run.conclusion === "success") return;

  // U forků bývá workflow_run.pull_requests prázdné. Hledáme podle SHA,
  // nikoli podle názvu větve, který nemusí být v různých repozitářích unikátní.
  const references = run.pull_requests?.length ? run.pull_requests :
    await github.paginate(github.rest.repos.listPullRequestsAssociatedWithCommit, {
      ...repo, commit_sha: run.head_sha, per_page: 100,
    });
  const jobs = await github.paginate(github.rest.actions.listJobsForWorkflowRun, {
    ...repo, run_id: run.id, filter: "latest", per_page: 100,
  });
  const body = formatCiFailure({ run, jobs, notifyUser });
  for (const reference of references) {
    const { data: pr } = await github.rest.pulls.get({ ...repo, pull_number: reference.number });
    if (pr.state !== "open" || (pr.head.sha !== run.head_sha && pr.merge_commit_sha !== run.head_sha)) {
      core.info(`PR #${pr.number} je uzavřený nebo už má novější commit.`);
      continue;
    }
    await commentOnce({ github, repo, number: pr.number, marker, body });
  }
  if (!references.length) core.warning("K neúspěšnému běhu už nelze dohledat PR. Odkaz na výsledek je v GitHub Actions.");
}
