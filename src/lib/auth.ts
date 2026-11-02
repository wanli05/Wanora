import { betterAuth, type BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { getDb, type Db } from "@/db";
import * as schema from "@/db/schema";
import { MIN_PASSWORD_LENGTH } from "./auth-constants";
import { getServerEnv, type ServerEnv } from "./env";
import { DEFAULT_LOCALE, localeSchema } from "./locale";

export function socialProviders(
  env: Pick<ServerEnv, "AUTH_GOOGLE_CLIENT_ID" | "AUTH_GOOGLE_CLIENT_SECRET">,
): BetterAuthOptions["socialProviders"] {
  if (!env.AUTH_GOOGLE_CLIENT_ID || !env.AUTH_GOOGLE_CLIENT_SECRET) return {};
  return {
    google: {
      clientId: env.AUTH_GOOGLE_CLIENT_ID,
      clientSecret: env.AUTH_GOOGLE_CLIENT_SECRET,
    },
  };
}

export function createAuth(db: Db, env: ServerEnv) {
  return betterAuth({
    appName: "Wanora",
    secret: env.AUTH_SECRET,
    baseURL: env.AUTH_URL,
    database: drizzleAdapter(db, { provider: "pg", schema, usePlural: true }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
    },
    socialProviders: socialProviders(env),
    user: {
      additionalFields: {
        uiLocale: {
          type: "string",
          required: false,
          defaultValue: DEFAULT_LOCALE,
          validator: { input: localeSchema },
        },
      },
    },
    telemetry: { enabled: false },
    plugins: [nextCookies()],
  });
}

export type Auth = ReturnType<typeof createAuth>;

let instance: Auth | undefined;

export function getAuth(): Auth {
  instance ??= createAuth(getDb(), getServerEnv());
  return instance;
}
