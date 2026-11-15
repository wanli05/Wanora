/** Postgres unique_violation (and nested drizzle cause). */
export function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String(error.code) : "";
  if (code === "23505") return true;
  const cause =
    "cause" in error && error.cause && typeof error.cause === "object"
      ? error.cause
      : null;
  return Boolean(cause && "code" in cause && String(cause.code) === "23505");
}
