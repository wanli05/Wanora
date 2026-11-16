import {
  APIConnectionError,
  APIError,
  APIUserAbortError,
  AuthenticationError,
  BadRequestError,
  InternalServerError,
  PermissionDeniedError,
  RateLimitError,
} from "openai";
import {
  ProviderCleanFailure,
  ProviderUncertainFailure,
} from "@/lib/ai/provider-errors";

/**
 * Map OpenAI SDK / transport errors to Job provider outcomes.
 * Conservative: unclear billing → Uncertain (no auto provider retry).
 */
export function mapOpenAiError(err: unknown): Error {
  if (
    err instanceof ProviderCleanFailure ||
    err instanceof ProviderUncertainFailure
  ) {
    return err;
  }

  if (err instanceof APIUserAbortError) {
    return new ProviderUncertainFailure(
      err.message || "openai request aborted",
      "provider_aborted",
    );
  }

  if (err instanceof APIConnectionError) {
    // Request may or may not have reached the server.
    return new ProviderUncertainFailure(
      err.message || "openai connection error",
      "provider_connection",
    );
  }

  if (err instanceof AuthenticationError || err instanceof PermissionDeniedError) {
    return new ProviderCleanFailure(
      err.message || "openai auth error",
      "provider_auth",
    );
  }

  if (err instanceof BadRequestError) {
    return new ProviderCleanFailure(
      err.message || "openai bad request",
      "provider_bad_request",
    );
  }

  if (err instanceof RateLimitError) {
    return new ProviderCleanFailure(
      err.message || "openai rate limited",
      "provider_rate_limited",
    );
  }

  if (err instanceof InternalServerError) {
    return new ProviderUncertainFailure(
      err.message || "openai server error",
      "provider_5xx",
    );
  }

  if (err instanceof APIError) {
    const status = err.status;
    if (status === 401 || status === 403) {
      return new ProviderCleanFailure(err.message, "provider_auth");
    }
    if (status === 400 || status === 404 || status === 422) {
      return new ProviderCleanFailure(err.message, "provider_bad_request");
    }
    if (status === 429) {
      return new ProviderCleanFailure(err.message, "provider_rate_limited");
    }
    if (typeof status === "number" && status >= 500) {
      return new ProviderUncertainFailure(err.message, "provider_5xx");
    }
    return new ProviderUncertainFailure(err.message, "provider_api_error");
  }

  if (err instanceof Error && err.name === "AbortError") {
    return new ProviderUncertainFailure(
      err.message || "aborted",
      "provider_aborted",
    );
  }

  if (err instanceof Error && /model_not_allowed/.test(err.message)) {
    return new ProviderCleanFailure(err.message, "model_not_allowed");
  }

  return new ProviderUncertainFailure(
    err instanceof Error ? err.message : "openai unknown error",
    "provider_uncertain",
  );
}
