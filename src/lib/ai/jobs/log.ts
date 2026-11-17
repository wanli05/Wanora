/**
 * Scrubbed worker / AI job logging — never emit secrets or prompt bodies.
 */

const SECRET_KEY =
  /api[_-]?key|authorization|password|secret|token|bearer/i;

export function scrubAiLogExtra(
  extra?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!extra) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(extra)) {
    if (SECRET_KEY.test(key)) {
      out[key] = "[redacted]";
      continue;
    }
    if (
      key === "messages" ||
      key === "content" ||
      key === "prompt" ||
      key === "body" ||
      key === "input" ||
      key === "rawResponse" ||
      key === "text"
    ) {
      out[key] = "[omitted]";
      continue;
    }
    if (typeof value === "string" && value.length > 500) {
      out[key] = `${value.slice(0, 80)}…[truncated ${value.length}]`;
      continue;
    }
    out[key] = value;
  }
  return out;
}

export function aiWorkerLog(
  msg: string,
  extra?: Record<string, unknown>,
): void {
  const scrubbed = scrubAiLogExtra(extra);
  if (scrubbed) {
    console.log(`[ai-worker] ${msg}`, scrubbed);
  } else {
    console.log(`[ai-worker] ${msg}`);
  }
}
