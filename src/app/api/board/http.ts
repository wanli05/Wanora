import { ProgressError } from "@/lib/progress/errors";
import { getSessionUser } from "@/lib/session";

export const unauthorized = () =>
  Response.json({ error: "unauthorized" }, { status: 401 });

export async function requireUser(request: Request) {
  return getSessionUser(request.headers);
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
  throw error;
}
