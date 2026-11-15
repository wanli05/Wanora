import { z } from "zod";

function boolFromEnv(defaultValue: boolean) {
  return z.preprocess((value) => {
    if (value === undefined || value === "") return defaultValue;
    if (value === true || value === "true") return true;
    if (value === false || value === "false") return false;
    return value;
  }, z.boolean());
}

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
    /** Phase 1A only ships mock; real ids are added when a provider is implemented. */
    AI_PROVIDER: z.enum(["mock"]).default("mock"),
    AI_DEFAULT_MODEL: z.string().min(1).optional(),
    AI_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(10),
    AI_DAILY_TOKEN_BUDGET: z.coerce.number().int().positive().default(100_000),
    AI_DAILY_COST_BUDGET_USD: z.coerce.number().nonnegative().default(1),
    /** Site-wide daily estimated cost cap (all users). */
    AI_GLOBAL_DAILY_COST_BUDGET_USD: z.coerce.number().nonnegative().default(20),
    AI_MAX_CONTEXT_CHARS: z.coerce.number().int().positive().default(12_000),
    AI_CHAT_HARD_DELETE_AFTER_DAYS: z.coerce.number().int().positive().default(30),
    /** Shared secret for externally scheduled chat hard-delete. */
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
  );

export type ServerEnv = z.infer<typeof serverEnvSchema>;

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
