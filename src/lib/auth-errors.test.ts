import { describe, expect, it } from "vitest";
import {
  authErrorMessageKey,
  parseExtraTrustedOrigins,
  trustedOriginsForAuthUrl,
} from "./auth-errors";

describe("authErrorMessageKey", () => {
  it("maps known Better Auth codes", () => {
    expect(
      authErrorMessageKey("sign-up", {
        code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
      }),
    ).toBe("emailTaken");
    expect(authErrorMessageKey("sign-up", { code: "INVALID_EMAIL" })).toBe(
      "invalidEmail",
    );
    expect(authErrorMessageKey("sign-up", { code: "PASSWORD_TOO_SHORT" })).toBe(
      "passwordTooShort",
    );
    expect(authErrorMessageKey("sign-up", { code: "INVALID_ORIGIN" })).toBe(
      "invalidOrigin",
    );
  });
});

describe("trustedOriginsForAuthUrl", () => {
  it("includes localhost and 127.0.0.1 for local dev", () => {
    expect(trustedOriginsForAuthUrl("http://localhost:3000")).toEqual([
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ]);
  });
});

describe("parseExtraTrustedOrigins", () => {
  it("parses comma-separated absolute origins", () => {
    expect(
      parseExtraTrustedOrigins(
        "http://172.30.0.2:3000, http://127.0.0.1:3000/path",
      ),
    ).toEqual(["http://172.30.0.2:3000", "http://127.0.0.1:3000"]);
  });

  it("skips empty and invalid entries", () => {
    expect(parseExtraTrustedOrigins(" , not-a-url, ")).toEqual([]);
    expect(parseExtraTrustedOrigins(undefined)).toEqual([]);
  });
});
