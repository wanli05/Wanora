/**
 * Fixed-point USD helpers (microdollars = 1e-6 USD).
 * Avoid JS float accumulation for budget math.
 */

const SCALE = BigInt(1_000_000);

export type UsdMicros = bigint;

export function usdToMicros(usd: string | number): UsdMicros {
  if (typeof usd === "number") {
    if (!Number.isFinite(usd) || usd < 0) {
      throw new Error(`invalid_usd:${usd}`);
    }
    // Round to nearest micro via string to avoid binary float noise.
    return usdToMicros(usd.toFixed(6));
  }
  const trimmed = usd.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`invalid_usd:${usd}`);
  }
  const [whole, frac = ""] = trimmed.split(".");
  const fracPadded = (frac + "000000").slice(0, 6);
  return BigInt(whole) * SCALE + BigInt(fracPadded);
}

export function microsToUsd(micros: UsdMicros): string {
  if (micros < BigInt(0)) throw new Error("negative_usd");
  const whole = micros / SCALE;
  const frac = (micros % SCALE).toString().padStart(6, "0");
  return `${whole}.${frac}`;
}

/** tokens * (usdPerMillion) / 1_000_000 → micros, rounded half-up. */
export function costMicrosForTokens(
  tokens: number,
  usdPerMillion: string,
): UsdMicros {
  if (!Number.isFinite(tokens) || tokens < 0 || !Number.isInteger(tokens)) {
    throw new Error(`invalid_tokens:${tokens}`);
  }
  const priceMicros = usdToMicros(usdPerMillion); // $ per 1M tokens as micros
  // cost = tokens * priceMicros / 1_000_000
  const num = BigInt(tokens) * priceMicros;
  const den = BigInt(1_000_000);
  return (num + den / BigInt(2)) / den;
}

export function addMicros(...parts: UsdMicros[]): UsdMicros {
  return parts.reduce((a, b) => a + b, BigInt(0));
}
