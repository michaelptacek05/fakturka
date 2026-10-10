import assert from "node:assert/strict";
import { test } from "node:test";

import { escapeMarkdown, mention } from "../../.github/agents/common.mjs";
import { notifyCi } from "../../.github/agents/notify-ci.mjs";
import { CODEX_BOT, notifyCodex, notifyCodexFromRun, priority, reviewFailed } from "../../.github/agents/notify-codex.mjs";

const SHA = "a".repeat(40);
const NEXT_SHA = "b".repeat(40);
const bot = { login: "github-actions[bot]", type: "Bot" };
const codex = { login: CODEX_BOT, type: "Bot" };

function harness(options = {}) {
  const calls = [];
  const comments = [];
  const issues = [];
  const pr = { number: 7, state: "open", head: { sha: SHA }, ...options.pr };
  const run = {
    id: 12, run_attempt: 1, workflow_id: 90,
    event: "pull_request", conclusion: "failure", head_sha: SHA,
    head_branch: "feat/invoice", pull_requests: [{ number: 7 }],
    name: "CI a publikace Docker image", html_url: "https://github.com/owner/repo/actions/runs/12",
    ...options.run,
  };
  const jobs = options.jobs ?? [{
    name: "Lint a typová kontrola", conclusion: "failure",
    steps: [{ name: "TypeScript", conclusion: "failure" }],
  }];
  const method = (name, result) => async (args) => {
    calls.push({ name, ...args });
    return { data: typeof result === "function" ? result(args) : result };
  };
  const github = {
    rest: {
      actions: {
        getWorkflowRun: method("getRun", { run_attempt: options.attempt ?? run.run_attempt }),
        listJobsForWorkflowRun: method("listJobs", jobs),
      },
      pulls: {
        get: method("getPr", pr),
        listCommentsForReview: method("reviewComments", options.reviewComments ?? []),
        listReviews: method("reviews", options.reviews ?? []),
        listReviewComments: method("inlineComments", options.reviewComments ?? []),
      },
      repos: {
        listPullRequestsAssociatedWithCommit: method("commitPrs", options.associatedPrs ?? [{ number: 7 }]),
      },
      git: { getRef: method("getRef", { object: { sha: options.branchSha ?? SHA } }) },
      issues: {
        listComments: method("listComments", () => comments),
        createComment: method("createComment", (args) => {
          const comment = { ...args, id: comments.length + 1, user: bot };
          comments.push(comment);
          return comment;
        }),
        listForRepo: method("listIssues", () => issues.filter((issue) => issue.state === "open")),
        create: method("createIssue", (args) => {
          const issue = { ...args, number: 50 + issues.length, state: "open", user: bot };
          issues.push(issue);
          return issue;
        }),
        update: method("updateIssue", (args) => {
          const issue = issues.find((entry) => entry.number === args.issue_number);
          Object.assign(issue, args);
          return issue;
        }),
      },
    },
    paginate: async (endpoint, args) => (await endpoint(args)).data,
  };
  const context = { repo: { owner: "owner", repo: "repo" },
    payload: { repository: { default_branch: "main" }, workflow_run: run } };
  const core = { info() {}, warning() {} };
  const args = { github, context, core, notifyUser: "michaelptacek05" };
  return { args, calls, comments, issues, run, pr };
}

function inline(overrides = {}) {
  return { id: 2, user: codex, path: "src/lib/invoice-payment.ts", line: 40,
    commit_id: SHA, pull_request_review_id: 30,
    body: "**<sub>![P1 Badge](https://img.shields.io/badge/P1-red)</sub> Oprav souběh úhrad**",
    html_url: "https://github.com/owner/repo/pull/7#discussion_r2", ...overrides };
}

function codexEvent(h, source, isReview = false) {
  h.args.context.payload = { ...h.args.context.payload,
    pull_request: { number: 7 }, [isReview ? "review" : "comment"]: source };
}

test("CI selhání upozorní příjemce a uvede krok, příkaz a logy", async () => {
  const h = harness();
  await notifyCi(h.args);
  assert.equal(h.comments.length, 1);
  assert.match(h.comments[0].body, /@michaelptacek05/);
  assert.match(h.comments[0].body, /npm run typecheck/);
  assert.match(h.comments[0].body, /actions\/runs\/12/);
});

test("doručení stejného CI eventu dvakrát nevytvoří duplicitu", async () => {
  const h = harness();
  await notifyCi(h.args);
  await notifyCi(h.args);
  assert.equal(h.comments.length, 1);
});

test("nový neúspěšný pokus CI znovu upozorní", async () => {
  const h = harness();
  await notifyCi(h.args);
  const next = harness({ run: { run_attempt: 2 } });
  h.args.context.payload.workflow_run.run_attempt = 2;
  h.args.github.rest.actions.getWorkflowRun = next.args.github.rest.actions.getWorkflowRun;
  await notifyCi(h.args);
  assert.equal(h.comments.length, 2);
});

test("opožděný výsledek starého pokusu neupozorní", async () => {
  const h = harness({ attempt: 2 });
  await notifyCi(h.args);
  assert.equal(h.comments.length, 0);
});

test("CI starého commitu a uzavřeného PR neupozorní", async () => {
  for (const pr of [{ head: { sha: NEXT_SHA } }, { state: "closed" }]) {
    const h = harness({ pr });
    await notifyCi(h.args);
    assert.equal(h.comments.length, 0);
  }
});

test("CI rozpozná přesný testovaný merge commit", async () => {
  const h = harness({ run: { head_sha: NEXT_SHA }, pr: { merge_commit_sha: NEXT_SHA } });
  await notifyCi(h.args);
  assert.equal(h.comments.length, 1);
});

test("fork PR se dohledá přes commit i bez workflow_run.pull_requests", async () => {
  const h = harness({ run: { pull_requests: [] } });
  await notifyCi(h.args);
  assert.equal(h.comments.length, 1);
  assert.equal(h.calls.find((call) => call.name === "commitPrs").commit_sha, SHA);
});

test("zrušený nebo úspěšný běh PR neposílá chybové upozornění", async () => {
  for (const conclusion of ["cancelled", "neutral", "success"]) {
    const h = harness({ run: { conclusion } });
    await notifyCi(h.args);
    assert.equal(h.comments.length, 0);
  }
});

test("timeout CI také upozorní, i když chybí neúspěšný krok", async () => {
  const h = harness({ run: { conclusion: "timed_out" }, jobs: [] });
  await notifyCi(h.args);
  assert.equal(h.comments.length, 1);
});

test("main vytvoří jedno issue, další selhání přidá komentář", async () => {
  const h = harness({ run: { event: "push", head_branch: "main" } });
  await notifyCi(h.args);
  await notifyCi(h.args);
  assert.equal(h.issues.length, 1);
  assert.equal(h.comments.length, 0);
  h.run.id = 13;
  await notifyCi(h.args);
  assert.equal(h.issues.length, 1);
  assert.equal(h.comments.length, 1);
});

test("úspěšný aktuální main uzavře incident", async () => {
  const h = harness({ run: { event: "push", head_branch: "main" } });
  await notifyCi(h.args);
  h.run.id = 13;
  h.run.conclusion = "success";
  await notifyCi(h.args);
  assert.equal(h.issues[0].state, "closed");
  assert.match(h.comments[0].body, /prošly/);
});

test("zastaralý main ani jiná větev nezaloží nebo neuzavře incident", async () => {
  for (const options of [{ branchSha: NEXT_SHA }, { run: { head_branch: "other" } }]) {
    const h = harness({ ...options, run: { event: "push", head_branch: "main", ...options.run } });
    await notifyCi(h.args);
    assert.equal(h.issues.length, 0);
  }
});

test("ruční zelené CI nezavře incident selhání Docker publikace při pushi", async () => {
  const h = harness({ run: { event: "push", head_branch: "main" } });
  await notifyCi(h.args);
  h.run.event = "workflow_dispatch";
  h.run.conclusion = "success";
  h.run.id = 13;
  await notifyCi(h.args);
  assert.equal(h.issues[0].state, "open");
});

test("job name se neinterpretuje jako zmínka uživatele ani HTML", async () => {
  const h = harness({ jobs: [{ name: "@someone <script>oops</script>", conclusion: "failure" }] });
  await notifyCi(h.args);
  assert.doesNotMatch(h.comments[0].body, /@someone|<script>/);
  assert.match(h.comments[0].body, /&#64;someone/);
});

test("Codex inline nález upozorní s odkazem na soubor", async () => {
  const h = harness();
  codexEvent(h, inline());
  await notifyCodex(h.args);
  assert.equal(h.comments.length, 1);
  assert.match(h.comments[0].body, /@michaelptacek05/);
  assert.match(h.comments[0].body, /invoice-payment.ts:40/);
  assert.match(h.comments[0].body, /discussion_r2/);
});

test("submitted review a inline event téhož review neposílají duplicity", async () => {
  const finding = inline();
  const h = harness({ reviewComments: [finding] });
  codexEvent(h, finding);
  await notifyCodex(h.args);
  codexEvent(h, { id: 30, user: codex, commit_id: SHA, body: "Codex review", html_url: "https://github.com/review" }, true);
  await notifyCodex(h.args);
  assert.equal(h.comments.length, 1);
});

test("Codex review sbírá konkrétní nálezy přes GitHub API", async () => {
  const h = harness({ reviewComments: [inline()] });
  codexEvent(h, { id: 30, user: codex, commit_id: SHA, body: "Codex review", html_url: "https://github.com/review" }, true);
  await notifyCodex(h.args);
  assert.equal(h.comments.length, 1);
  assert.match(h.comments[0].body, /P1/);
});

test("jiný bot, uživatel se stejným loginem a běžný komentář nemohou spustit alert", async () => {
  for (const user of [{ login: "other[bot]", type: "Bot" }, { login: CODEX_BOT, type: "User" }]) {
    const h = harness();
    codexEvent(h, inline({ user }));
    await notifyCodex(h.args);
    assert.equal(h.comments.length, 0);
  }
});

test("staré Codex review, uzavřený PR a odpověď ve vlákně neupozorní", async () => {
  for (const options of [{ pr: { head: { sha: NEXT_SHA } } }, { pr: { state: "closed" } }, {}]) {
    const h = harness(options);
    codexEvent(h, inline(options.pr ? {} : { in_reply_to_id: 1 }));
    await notifyCodex(h.args);
    assert.equal(h.comments.length, 0);
  }
});

test("P3 návrh a čisté review neposílají chybový alert", async () => {
  const h = harness();
  codexEvent(h, inline({ body: "[P3] Optional naming" }));
  await notifyCodex(h.args);
  codexEvent(h, { id: 30, user: codex, commit_id: SHA, body: "Didn't find any major issues.", html_url: "https://github.com/review" }, true);
  await notifyCodex(h.args);
  assert.equal(h.comments.length, 0);
});

test("zpráva o limitu Codexu na PR upozorní na nedokončené review", async () => {
  const h = harness();
  h.args.context.payload = { issue: { number: 7, pull_request: {} },
    comment: { id: 60, user: codex, body: "You have reached your Codex usage limits. Please try again later.", html_url: "https://github.com/comment" } };
  await notifyCodex(h.args);
  assert.equal(h.comments.length, 1);
  assert.match(h.comments[0].body, /nepodařilo dokončit/);
});

test("požadavek Codexu na změny upozorní i bez rozpoznaného badge", async () => {
  const h = harness();
  codexEvent(h, { id: 30, user: codex, commit_id: SHA, state: "changes_requested", body: "Oprav validaci", html_url: "https://github.com/review" }, true);
  await notifyCodex(h.args);
  assert.equal(h.comments.length, 1);
});

test("top-level nález se zkráceným SHA se neposílá pro nový commit", async () => {
  const h = harness({ pr: { head: { sha: NEXT_SHA } } });
  codexEvent(h, { id: 50, user: codex, body: `[P1] Regression\nReviewed commit: \`${SHA.slice(0, 10)}\``, html_url: "https://github.com/comment" });
  await notifyCodex(h.args);
  assert.equal(h.comments.length, 0);
});

test("neznámý formát inline připomínky se neztratí", async () => {
  const h = harness();
  codexEvent(h, inline({ body: "Změna dovolí souběžně přijmout přeplatek." }));
  await notifyCodex(h.args);
  assert.equal(h.comments.length, 1);
});

test("uživatelské kopie deduplikačního markeru nepotlačí upozornění", async () => {
  const h = harness();
  h.comments.push({ user: { login: "attacker", type: "User" }, body: "<!-- fakturka-ci-run:12:1 -->" });
  await notifyCi(h.args);
  assert.equal(h.comments.length, 2);
});

test("parser rozpozná badge i hranaté závorky a vážnější prioritu", () => {
  assert.equal(priority("[P2] finding"), 2);
  assert.equal(priority("![P0 Badge](url) finding"), 0);
  assert.equal(priority("[P2] and [P1]"), 1);
  assert.equal(priority("No findings"), null);
  assert.equal(reviewFailed("Codex is unable to review this PR"), true);
  assert.equal(reviewFailed("Didn't find any major issues"), false);
});

test("příjemce je validní login a v datech se neutralizují zmínky", () => {
  assert.equal(mention("michaelptacek05"), "@michaelptacek05");
  assert.throws(() => mention("user @someone"), /AGENT_NOTIFY_USER/);
  assert.equal(escapeMarkdown("<b>@user</b>"), "&lt;b&gt;&#64;user&lt;/b&gt;");
});

test("privilegovaný notifikátor zpracuje review fork PR bez artefaktů", async () => {
  const finding = inline();
  const h = harness({ run: { event: "pull_request_review", conclusion: "success", pull_requests: [] },
    reviews: [{ id: 30, user: codex, commit_id: SHA, body: "Codex review", html_url: "https://github.com/review" }],
    reviewComments: [finding] });
  await notifyCodexFromRun(h.args);
  assert.equal(h.comments.length, 1);
  assert.match(h.comments[0].body, /invoice-payment/);
});

test("review_comment událost bez submitted review přesto doručí nález", async () => {
  const h = harness({ run: { event: "pull_request_review_comment", conclusion: "success" }, reviewComments: [inline()] });
  await notifyCodexFromRun(h.args);
  assert.equal(h.comments.length, 1);
});

test("předaná událost starého review a jiný typ workflow neupozorní", async () => {
  const stale = harness({ run: { event: "pull_request_review", conclusion: "success" },
    pr: { head: { sha: NEXT_SHA } }, reviewComments: [inline()] });
  await notifyCodexFromRun(stale.args);
  assert.equal(stale.comments.length, 0);
  const unrelated = harness({ reviewComments: [inline()] });
  await notifyCodexFromRun(unrelated.args);
  assert.equal(unrelated.comments.length, 0);
});
