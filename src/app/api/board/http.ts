import { ProgressError } from "@/lib/progress/errors";
import { getSessionUser } from "@/lib/session";

export const unauthorized = () =>
  Response.json({ error: "unauthorized" }, { status: 401 });

export async function requireUser(request: Request) {
  return getSessionUser(request.headers);
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String(error.code) : "";
  if (code === "23505") return true;
  const cause =
    "cause" in error && error.cause && typeof error.cause === "object"
      ? error.cause
      : null;
  return Boolean(cause && "code" in cause && String(cause.code) === "23505");
}

export function progressResponse(error: unknown) {
  if (error instanceof ProgressError) {
    const status =
      error.code === "not_found"
        ? 404
        : error.code === "conflict"
          ? 409
          : 400;
    return Response.json(
      { error: error.code, message: error.message, details: error.details },
      { status },
    );
  }
  // Stale DB still enforcing UNIQUE(interview_id) surfaces as a 500 otherwise.
  if (isUniqueViolation(error)) {
    return Response.json(
      {
        error: "conflict",
        message:
          "interview already has feedback; run migrations or edit/append after 0005",
      },
      { status: 409 },
    );
  }
  throw error;
}
