import { describe, expect, it } from "vitest";
import { socialProviders } from "./auth";

describe("socialProviders", () => {
  it("enables Google only when credentials are configured", () => {
    expect(socialProviders({})).toEqual({});
    expect(
      socialProviders({
        AUTH_GOOGLE_CLIENT_ID: "id",
        AUTH_GOOGLE_CLIENT_SECRET: "secret",
      }),
    ).toEqual({ google: { clientId: "id", clientSecret: "secret" } });
  });
});
