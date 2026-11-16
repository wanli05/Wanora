/**
 * Provider outcome errors shared by Job execute and real adapters.
 * Clean → safe to release reserved budget; Uncertain → hold until reconcile.
 */

/** Confirmed non-billing (or safely releasable) provider failure. */
export class ProviderCleanFailure extends Error {
  readonly code: string;
  constructor(message: string, code = "provider_failed") {
    super(message);
    this.name = "ProviderCleanFailure";
    this.code = code;
  }
}

/** Provider outcome unknown — must not auto-retry or assume free. */
export class ProviderUncertainFailure extends Error {
  readonly code: string;
  constructor(message: string, code = "provider_uncertain") {
    super(message);
    this.name = "ProviderUncertainFailure";
    this.code = code;
  }
}
