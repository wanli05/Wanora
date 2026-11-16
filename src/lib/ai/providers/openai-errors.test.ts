import { describe, expect, it } from "vitest";
import {
  APIConnectionError,
  APIError,
  APIUserAbortError,
  AuthenticationError,
  BadRequestError,
  InternalServerError,
  RateLimitError,
} from "openai";
import {
  ProviderCleanFailure,
  ProviderUncertainFailure,
} from "@/lib/ai/provider-errors";
import { mapOpenAiError } from "@/lib/ai/providers/openai-errors";

function headers() {
  return new Headers();
}

describe("mapOpenAiError", () => {
  it("maps auth and bad request to clean failures", () => {
    const auth = mapOpenAiError(
      APIError.generate(401, { message: "nope" }, "nope", headers()),
    );
    expect(auth).toBeInstanceOf(ProviderCleanFailure);
    expect((auth as ProviderCleanFailure).code).toBe("provider_auth");

    const bad = mapOpenAiError(
      new BadRequestError(400, { message: "bad" }, "bad", headers()),
    );
    expect(bad).toBeInstanceOf(ProviderCleanFailure);
    expect((bad as ProviderCleanFailure).code).toBe("provider_bad_request");

    const rate = mapOpenAiError(
      new RateLimitError(429, { message: "slow" }, "slow", headers()),
    );
    expect(rate).toBeInstanceOf(ProviderCleanFailure);
    expect((rate as ProviderCleanFailure).code).toBe("provider_rate_limited");
  });

  it("maps 5xx, connection, and abort to uncertain", () => {
    const server = mapOpenAiError(
      new InternalServerError(500, { message: "boom" }, "boom", headers()),
    );
    expect(server).toBeInstanceOf(ProviderUncertainFailure);
    expect((server as ProviderUncertainFailure).code).toBe("provider_5xx");

    const conn = mapOpenAiError(
      new APIConnectionError({ message: "offline" }),
    );
    expect(conn).toBeInstanceOf(ProviderUncertainFailure);

    const abort = mapOpenAiError(new APIUserAbortError());
    expect(abort).toBeInstanceOf(ProviderUncertainFailure);
    expect((abort as ProviderUncertainFailure).code).toBe("provider_aborted");
  });

  it("passes through existing provider failures", () => {
    const clean = new ProviderCleanFailure("x", "y");
    expect(mapOpenAiError(clean)).toBe(clean);
  });

  it("maps AuthenticationError class", () => {
    const err = mapOpenAiError(
      new AuthenticationError(401, { message: "key" }, "key", headers()),
    );
    expect(err).toBeInstanceOf(ProviderCleanFailure);
  });
});
