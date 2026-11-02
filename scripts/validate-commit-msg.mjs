import { readFileSync } from "node:fs";
import { validateCommitMessage } from "./validate-commit-message.mjs";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/validate-commit-msg.mjs <commit-msg-file>");
  process.exit(2);
}

const error = validateCommitMessage(readFileSync(file, "utf8"));
if (error) {
  console.error(`commit-msg hook: ${error}`);
  process.exit(1);
}
