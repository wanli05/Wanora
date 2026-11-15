import { getSessionUser } from "@/lib/session";

export type AiApiErrorCode =
  | "unauthorized"
  | "not_found"
  | "invalid_body"
  | "invalid_query"
  | "invalid_params";

export function aiError(
  code: AiApiErrorCode,
  status: number,
  message?: string,
  details?: unknown,
) {
  return Response.json(
    {
      error: code,
      ...(message ? { message } : {}),
      ...(details !== undefined ? { details } : {}),
    },
    { status },
  );
}

export const unauthorized = () => aiError("unauthorized", 401);
export const notFound = () => aiError("not_found", 404);

export async function requireAiUser(request: Request) {
  return getSessionUser(request.headers);
}

export function parseSearchParams(url: string) {
  return Object.fromEntries(new URL(url).searchParams.entries());
}
