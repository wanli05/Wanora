export type AuthClientError = {
  code?: string | null;
  message?: string | null;
};

export type AuthMessageKey =
  | "emailTaken"
  | "invalidEmail"
  | "passwordTooShort"
  | "invalidOrigin"
  | "signIn.error"
  | "signUp.error";

/** Map Better Auth error codes to `Auth.*` message keys. */
export function authErrorMessageKey(
  mode: "sign-in" | "sign-up",
  error: AuthClientError | null | undefined,
): AuthMessageKey {
  const code = error?.code ?? "";
  if (code.startsWith("USER_ALREADY_EXISTS")) return "emailTaken";
  if (code === "INVALID_EMAIL") return "invalidEmail";
  if (code === "PASSWORD_TOO_SHORT" || code === "INVALID_PASSWORD") {
    return "passwordTooShort";
  }
  if (code === "INVALID_ORIGIN") return "invalidOrigin";
  if (mode === "sign-in" && code === "INVALID_EMAIL_OR_PASSWORD") {
    return "signIn.error";
  }
  return mode === "sign-up" ? "signUp.error" : "signIn.error";
}

/** Accept both localhost and 127.0.0.1 when developing on a fixed port. */
export function trustedOriginsForAuthUrl(authUrl: string): string[] {
  const url = new URL(authUrl);
  const origins = new Set<string>([url.origin]);
  const port =
    url.port || (url.protocol === "https:" ? "443" : "80");
  if (url.hostname === "localhost") {
    origins.add(`${url.protocol}//127.0.0.1:${port}`);
  } else if (url.hostname === "127.0.0.1") {
    origins.add(`${url.protocol}//localhost:${port}`);
  }
  return [...origins];
}
