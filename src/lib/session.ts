import { getAuth } from "./auth";
import type { Locale } from "./locale";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  uiLocale: Locale;
};

// Data Access Layer entry point: every user-scoped read/write must take the
// user id from here, never from request params or body.
export async function getSessionUser(
  headers: Headers,
): Promise<SessionUser | null> {
  const session = await getAuth().api.getSession({ headers });
  if (!session) return null;
  const { id, email, name, uiLocale } = session.user;
  return { id, email, name, uiLocale: uiLocale as Locale };
}
