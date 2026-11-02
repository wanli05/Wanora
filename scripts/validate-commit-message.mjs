/** @param {string} message */
export function validateCommitMessage(message) {
  const PLACEHOLDER_SUBJECTS = new Set(
    ["update", "fix", "wip", "changes"].map((s) => s.toLowerCase()),
  );
  const subject = message.split("\n")[0]?.trim() ?? "";
  if (!subject) {
    return "Commit subject must not be empty.";
  }
  if (PLACEHOLDER_SUBJECTS.has(subject.toLowerCase())) {
    return `Commit subject "${subject}" is too vague; describe what changed.`;
  }
  if (subject.length < 4) {
    return "Commit subject is too short; describe what changed.";
  }
  return null;
}
