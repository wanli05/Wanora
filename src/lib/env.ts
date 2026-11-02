import { z } from "zod";

const serverEnvSchema = z
  .object({
    DATABASE_URL: z.url(),
    AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 chars"),
    AUTH_URL: z.url().default("http://localhost:3000"),
    AUTH_GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    AUTH_GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  })
  .refine(
    (env) => !!env.AUTH_GOOGLE_CLIENT_ID === !!env.AUTH_GOOGLE_CLIENT_SECRET,
    {
      message:
        "AUTH_GOOGLE_CLIENT_ID and AUTH_GOOGLE_CLIENT_SECRET must be set together",
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
