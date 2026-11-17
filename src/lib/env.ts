import { z } from "zod";

function boolFromEnv(defaultValue: boolean) {
  return z.preprocess((value) => {
    if (value === undefined || value === "") return defaultValue;
    if (value === true || value === "true") return true;
    if (value === false || value === "false") return false;
    return value;
  }, z.boolean());
}

/**
 * B1 default model candidate (Responses API). Org entitlement is env-specific —
 * verify OPENAI access before enabling AI_PROVIDER=openai in production.
 */
export const AI_B1_DEFAULT_MODEL = "gpt-6.1-terra";

const serverEnvSchema = z
  .object({
    DATABASE_URL: z.url(),
    AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 chars"),
    AUTH_URL: z.url().default("http://localhost:3000"),
    AUTH_GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    AUTH_GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
    S3_ENDPOINT: z.url().optional(),
    S3_ACCESS_KEY: z.string().min(1).optional(),
    S3_SECRET_KEY: z.string().min(1).optional(),
    S3_BUCKET: z.string().min(1).optional(),
    S3_REGION: z.string().min(1).optional(),
    /** Master switch for AI features. Default off. */
    AI_ENABLED: boolFromEnv(false),
    /** mock for CI/local; openai for real Responses API (requires key). */
    AI_PROVIDER: z.enum(["mock", "openai"]).default("mock"),
    AI_DEFAULT_MODEL: z.string().min(1).optional(),
    /** Required when AI_PROVIDER=openai. Never expose to the browser. */
    OPENAI_API_KEY: z.string().min(1).optional(),
    /** Hard timeout for OpenAI Responses calls (adapter AbortSignal). */
    AI_OPENAI_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
    AI_OPENAI_MAX_OUTPUT_TOKENS: z.coerce
      .number()
      .int()
      .positive()
      .default(2048),
    /** Soft caps for context / history in reserve + execute prompt build. */
    AI_MAX_HISTORY_MESSAGES: z.coerce.number().int().positive().default(40),
    AI_MAX_INPUT_CHARS: z.coerce.number().int().positive().default(100_000),
    /** Comma-separated model allowlist; empty = only enforce when set. */
    AI_ALLOWED_MODELS: z.string().optional(),
    /** Must match pricing catalog.version used for estimates / settlement. */
    AI_PRICING_VERSION: z.string().min(1).default("2026-11-17"),
    /**
     * Opt-in live smoke only. Must stay false in CI — never call paid APIs by default.
     */
    AI_LIVE_SMOKE: boolFromEnv(false),
    AI_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(10),
    AI_DAILY_TOKEN_BUDGET: z.coerce.number().int().positive().default(100_000),
    AI_DAILY_COST_BUDGET_USD: z.coerce.number().nonnegative().default(1),
    /** Site-wide daily estimated cost cap (all users). */
    AI_GLOBAL_DAILY_COST_BUDGET_USD: z.coerce.number().nonnegative().default(20),
    AI_MAX_CONTEXT_CHARS: z.coerce.number().int().positive().default(12_000),
    AI_CHAT_HARD_DELETE_AFTER_DAYS: z.coerce.number().int().positive().default(30),
    /**
     * After a job is marked provider_uncertain, keep reserved budget this many
     * hours for audit, then release via reconcile (default 24h).
     */
    AI_UNCERTAIN_RECONCILE_AFTER_HOURS: z.coerce
      .number()
      .int()
      .positive()
      .default(24),
    /** Shared secret for externally scheduled chat hard-delete / reconcile. */
    AI_PURGE_SECRET: z.string().min(1).optional(),
  })
  .refine(
    (env) => !!env.AUTH_GOOGLE_CLIENT_ID === !!env.AUTH_GOOGLE_CLIENT_SECRET,
    {
      message:
        "AUTH_GOOGLE_CLIENT_ID and AUTH_GOOGLE_CLIENT_SECRET must be set together",
    },
  )
  .refine(
    (env) => {
      const keys = [
        env.S3_ENDPOINT,
        env.S3_ACCESS_KEY,
        env.S3_SECRET_KEY,
        env.S3_BUCKET,
      ];
      const set = keys.filter(Boolean).length;
      return set === 0 || set === 4;
    },
    {
      message:
        "S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, and S3_BUCKET must be set together",
    },
  )
  .refine(
    (env) => env.AI_PROVIDER !== "openai" || Boolean(env.OPENAI_API_KEY),
    {
      message: "OPENAI_API_KEY is required when AI_PROVIDER=openai",
      path: ["OPENAI_API_KEY"],
    },
  )
  .refine(
    (env) => {
      if (env.AI_PROVIDER !== "openai" || !env.AI_ENABLED) return true;
      const model = env.AI_DEFAULT_MODEL?.trim() || AI_B1_DEFAULT_MODEL;
      const allowed = parseAllowedModels(env.AI_ALLOWED_MODELS);
      if (allowed.length === 0) return true;
      return allowed.includes(model);
    },
    {
      message:
        "AI_DEFAULT_MODEL must be in AI_ALLOWED_MODELS when AI is enabled with openai",
      path: ["AI_DEFAULT_MODEL"],
    },
  );

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseAllowedModels(
  raw: string | undefined | null,
): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseServerEnv(
  source: Record<string, string | undefined>,
): ServerEnv {
  const cleaned = Object.fromEntries(
    Object.entries(source).filter(([, v]) => v !== ""),
  );
  return serverEnvSchema.parse(cleaned);
}

let cached: ServerEnv | undefined;

// Parsed lazily so `next build` does not require runtime secrets.
export function getServerEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}

/** Clear cached env (tests that mutate process.env). */
export function resetServerEnvCache() {
  cached = undefined;
}

export function isObjectStorageConfigured(
  env: ServerEnv = getServerEnv(),
): boolean {
  return Boolean(
    env.S3_ENDPOINT &&
      env.S3_ACCESS_KEY &&
      env.S3_SECRET_KEY &&
      env.S3_BUCKET,
  );
}

export function isAiEnabled(env: ServerEnv = getServerEnv()): boolean {
  return env.AI_ENABLED;
}

/** Resolve model for a request; enforces allowlist when configured. */
export function resolveAiModel(
  requested: string | undefined,
  env: ServerEnv = getServerEnv(),
): string {
  const model =
    requested?.trim() ||
    env.AI_DEFAULT_MODEL?.trim() ||
    (env.AI_PROVIDER === "openai" ? AI_B1_DEFAULT_MODEL : "mock-v1");
  const allowed = parseAllowedModels(env.AI_ALLOWED_MODELS);
  if (allowed.length > 0 && !allowed.includes(model)) {
    throw new Error(`model_not_allowed:${model}`);
  }
  return model;
}
