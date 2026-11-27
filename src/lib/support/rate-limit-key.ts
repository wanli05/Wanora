import { createHash } from "node:crypto";

/**
 * Derive a rate-limit bucket key. Never store raw IP.
 * Prefer authenticated user id; else hash of forwarded / remote address.
 */
export function supportRateLimitKey(opts: {
  userId?: string | null;
  request: Request;
}): string {
  if (opts.userId?.trim()) return `user:${opts.userId.trim()}`;

  const forwarded = opts.request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  const raw =
    first ||
    opts.request.headers.get("x-real-ip")?.trim() ||
    opts.request.headers.get("cf-connecting-ip")?.trim() ||
    "unknown";
  const hash = createHash("sha256").update(raw).digest("hex").slice(0, 32);
  return `ip:${hash}`;
}
