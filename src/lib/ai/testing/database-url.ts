/**
 * Guardrails for AI smoke / harness scripts.
 *
 * localhost alone is NOT enough — the shared local DB name `wanora` is the
 * everyday development database and must never be treated as isolated.
 */

export type AiTestDatabaseUrlCheck =
  | { ok: true; host: string; database: string; reason: string }
  | { ok: false; host: string | null; database: string | null; reason: string };

const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1"]);

/** Explicit shared-dev / production-ish names that must never pass. */
const FORBIDDEN_DB_NAMES = new Set([
  "wanora",
  "postgres",
  "production",
  "prod",
  "main",
]);

/**
 * Acceptable isolated DB names:
 * - Testcontainers default (`test`)
 * - Explicit markers: wanora_test, wanora_ai_test, *_test, test_*
 */
const ALLOWED_DB_NAME =
  /^(test|wanora[_-]?(ai[_-]?)?test|.*_test|test_.*)$/i;

const CLOUD_HOST_HINT =
  /(neon\.tech|supabase\.co|rds\.amazonaws\.com|azure\.com|cloud\.sql|render\.com|railway\.app|vercel-storage|planetscale|cockroachlabs\.cloud)/i;

function parseDatabaseUrl(url: string): {
  host: string | null;
  database: string | null;
  username: string | null;
} {
  try {
    const u = new URL(url);
    const database = decodeURIComponent(u.pathname.replace(/^\//, "") || "");
    return {
      host: u.hostname || null,
      database: database || null,
      username: decodeURIComponent(u.username || "") || null,
    };
  } catch {
    return { host: null, database: null, username: null };
  }
}

/**
 * Returns whether a DATABASE_URL is safe for destructive / queue AI tests.
 * Does not mutate env. Never logs secrets.
 */
export function checkAiIsolatedDatabaseUrl(
  url: string | undefined | null,
  options?: { requireLoopback?: boolean },
): AiTestDatabaseUrlCheck {
  const requireLoopback = options?.requireLoopback !== false;
  if (!url?.trim()) {
    return {
      ok: false,
      host: null,
      database: null,
      reason: "DATABASE_URL is empty",
    };
  }

  const { host, database, username } = parseDatabaseUrl(url);
  if (!host || !database) {
    return {
      ok: false,
      host,
      database,
      reason: "DATABASE_URL could not be parsed (host/database required)",
    };
  }

  if (CLOUD_HOST_HINT.test(host)) {
    return {
      ok: false,
      host,
      database,
      reason: `host looks like a managed/cloud database (${host})`,
    };
  }

  if (requireLoopback && !LOOPBACK.has(host)) {
    return {
      ok: false,
      host,
      database,
      reason: `host is not loopback (${host}); refuse non-local AI test DB`,
    };
  }

  const dbLower = database.toLowerCase();
  if (FORBIDDEN_DB_NAMES.has(dbLower)) {
    return {
      ok: false,
      host,
      database,
      reason: `database name "${database}" is forbidden for AI isolation tests (shared/dev/default)`,
    };
  }

  if (!ALLOWED_DB_NAME.test(database)) {
    return {
      ok: false,
      host,
      database,
      reason: `database name "${database}" lacks an explicit test marker (e.g. wanora_ai_test)`,
    };
  }

  // Testcontainers default: postgres://test:test@localhost:<port>/test
  if (dbLower === "test" && username && username.toLowerCase() !== "test") {
    return {
      ok: false,
      host,
      database,
      reason: `database "test" is only accepted for Testcontainers-style user "test" (got "${username}")`,
    };
  }

  return {
    ok: true,
    host,
    database,
    reason:
      dbLower === "test"
        ? "testcontainers-style loopback/test"
        : "explicit test-marker database on loopback",
  };
}

/** Throws when the URL is not an isolated AI test database. */
export function assertAiIsolatedDatabaseUrl(
  url: string | undefined | null,
  options?: { requireLoopback?: boolean },
): asserts url is string {
  const check = checkAiIsolatedDatabaseUrl(url, options);
  if (!check.ok) {
    throw new Error(`AI test DB isolation check failed: ${check.reason}`);
  }
}

/**
 * Resolve URL for AI harness scripts.
 * Prefer WANORA_AI_TEST_DATABASE_URL; never silently use a shared `wanora` DB.
 */
export function resolveAiTestDatabaseUrl(
  env: Record<string, string | undefined> = process.env,
): string {
  const explicit = env.WANORA_AI_TEST_DATABASE_URL?.trim();
  if (explicit) {
    assertAiIsolatedDatabaseUrl(explicit);
    return explicit;
  }

  // Vitest integration injects Testcontainers via DATABASE_URL + marker.
  if (env.WANORA_AI_TEST_DB === "1" && env.DATABASE_URL?.trim()) {
    assertAiIsolatedDatabaseUrl(env.DATABASE_URL);
    return env.DATABASE_URL;
  }

  throw new Error(
    "No isolated AI test database configured. Set WANORA_AI_TEST_DATABASE_URL " +
      "to a loopback DB whose name contains a test marker (e.g. wanora_ai_test), " +
      "or run under Vitest integration (Testcontainers). " +
      "Refusing to use the shared development database.",
  );
}
