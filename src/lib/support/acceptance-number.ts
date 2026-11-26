import { randomBytes } from "node:crypto";

/** Tokyo calendar date YYYYMMDD for acceptance numbers. */
export function tokyoYmd(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(now)
    .replaceAll("-", "");
}

/**
 * User-facing 受理编号, e.g. WR-20261126-A1B2C3.
 * Collision is extremely unlikely; DB unique constraint retries at insert layer.
 */
export function generateAcceptanceNumber(now = new Date()): string {
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  return `WR-${tokyoYmd(now)}-${suffix}`;
}
