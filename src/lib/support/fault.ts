import { randomUUID } from "node:crypto";
import type { SupportErrorCode, SupportModule } from "@/lib/support/types";

export type ServerFaultLogInput = {
  faultId?: string;
  errorCode: SupportErrorCode;
  module: SupportModule;
  operation: string;
  /** Safe short reason — never include form/resume/AI body. */
  reason?: string;
  /** Error name / code only; message truncated & scrubbed. */
  err?: unknown;
};

/**
 * Create a fault id for one concrete failure incident.
 * Prefer reusing an existing correlation id (AI job id / clientRequestId) when available.
 */
export function createFaultId(existing?: string | null): string {
  const trimmed = existing?.trim();
  if (trimmed && trimmed.length <= 128) return trimmed;
  return `flt_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

function scrubError(err: unknown): { name?: string; code?: string; message?: string } {
  if (!err || typeof err !== "object") {
    return { message: typeof err === "string" ? err.slice(0, 120) : undefined };
  }
  const e = err as Record<string, unknown>;
  const name = typeof e.name === "string" ? e.name.slice(0, 64) : undefined;
  const code =
    typeof e.code === "string" || typeof e.code === "number"
      ? String(e.code).slice(0, 64)
      : undefined;
  const raw =
    typeof e.message === "string" ? e.message.replace(/\s+/g, " ").trim() : "";
  // Drop likely PII / bodies from unexpected messages.
  const message = raw
    ? raw.slice(0, 160).replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted]")
    : undefined;
  return { name, code, message };
}

/**
 * Structured server fault log. Never includes resume, chat, request body, email.
 * Returns the faultId so callers can surface it to the client for お問い合わせ.
 */
export function logServerFault(input: ServerFaultLogInput): string {
  const faultId = createFaultId(input.faultId);
  const payload = {
    kind: "server_fault",
    faultId,
    errorCode: input.errorCode,
    module: input.module,
    operation: input.operation,
    reason: input.reason?.slice(0, 120),
    err: scrubError(input.err),
    at: new Date().toISOString(),
  };
  console.error(JSON.stringify(payload));
  return faultId;
}
