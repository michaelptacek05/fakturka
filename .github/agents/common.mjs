export const ACTIONS_BOT = "github-actions[bot]";
export const FAILED = new Set(["failure", "timed_out", "action_required", "startup_failure"]);

export function escapeMarkdown(value) {
  return String(value ?? "")
    .replace(/[\\`*_[\]{}()#|!]/g, "\\$&")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/@/g, "&#64;");
}

export function mention(login) {
  if (!/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(login ?? "")) {
    throw new Error("AGENT_NOTIFY_USER musí být GitHub uživatelské jméno.");
  }
  return `@${login}`;
}

export function isOwnMessage(message) {
  return message.user?.type === "Bot" && message.user.login === ACTIONS_BOT;
}

export async function commentOnce({ github, repo, number, marker, body }) {
  const comments = await github.paginate(github.rest.issues.listComments, {
    ...repo, issue_number: number, per_page: 100,
  });
  if (comments.some((comment) => isOwnMessage(comment) && comment.body?.includes(marker))) {
    return false;
  }
  await github.rest.issues.createComment({
    ...repo, issue_number: number, body: `${body}\n\n${marker}`,
  });
  return true;
}
