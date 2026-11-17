/**
 * Mock-only AI job smoke on an isolated Postgres (Testcontainers by default).
 *
 * - Never calls OpenAI
 * - Never uses the shared development DB (`wanora`)
 * - Never bulk-cancels queued/running jobs
 * - Claims only the job created in this run (by id)
 * - Cleans up only the fiction user created in this run
 *
 * Usage:
 *   pnpm exec tsx scripts/ai-mock-job-smoke.mts
 *
 * Optional: WANORA_AI_TEST_DATABASE_URL=postgres://...@localhost/.../wanora_ai_test
 */
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { createDb } from "../src/db";
import { runMigrations } from "../src/db/migrate";
import { enqueueAiJob } from "../src/lib/ai/jobs/enqueue";
import { executeAiJob } from "../src/lib/ai/jobs/execute";
import { createMockAiProvider } from "../src/lib/ai/providers/mock";
import { createAiConversation } from "../src/lib/data/ai-conversations";
import { getAiJobById } from "../src/lib/data/ai-jobs";
import { getAiDailyBudgetCounter } from "../src/lib/data/ai-budget";
import { users, aiUsageEvents } from "../src/db/schema";
import { eq } from "drizzle-orm";
import {
  assertAiIsolatedDatabaseUrl,
  checkAiIsolatedDatabaseUrl,
  claimAiJobByIdForTest,
  cleanupAiTestUserData,
} from "../src/lib/ai/testing";
import { resetServerEnvCache } from "../src/lib/env";

const OUT = new URL("./ai-mock-job-smoke-result.json", import.meta.url);

function write(payload: unknown, code = 0) {
  writeFileSync(OUT, JSON.stringify(payload, null, 2), "utf8");
  console.log(JSON.stringify(payload, null, 2));
  process.exitCode = code;
}

process.env.AI_ENABLED = "true";
process.env.AI_PROVIDER = "mock";
process.env.AI_LIVE_SMOKE = "false";
process.env.AI_PRICING_VERSION = "2026-11-17";
process.env.AI_OPENAI_MAX_OUTPUT_TOKENS ??= "64";
process.env.AI_RATE_LIMIT_PER_MINUTE ??= "50";
process.env.AI_DAILY_TOKEN_BUDGET ??= "100000";
process.env.AI_DAILY_COST_BUDGET_USD ??= "1";
process.env.AI_GLOBAL_DAILY_COST_BUDGET_USD ??= "20";
process.env.AUTH_SECRET ??= "mock-smoke-secret-0123456789abcdef";
process.env.AUTH_URL ??= "http://localhost:3000";
delete process.env.OPENAI_API_KEY;
resetServerEnvCache();

let container: StartedPostgreSqlContainer | undefined;

async function resolveUrl(): Promise<{
  url: string;
  ephemeral: boolean;
}> {
  const explicit = process.env.WANORA_AI_TEST_DATABASE_URL?.trim();
  if (explicit) {
    assertAiIsolatedDatabaseUrl(explicit);
    return { url: explicit, ephemeral: false };
  }

  // Refuse accidental shared-dev DATABASE_URL from the shell / .env.
  if (process.env.DATABASE_URL?.trim()) {
    const check = checkAiIsolatedDatabaseUrl(process.env.DATABASE_URL);
    if (!check.ok) {
      throw new Error(
        `Refusing DATABASE_URL for mock smoke (${check.reason}). ` +
          `Unset DATABASE_URL to use Testcontainers, or set WANORA_AI_TEST_DATABASE_URL.`,
      );
    }
    process.env.WANORA_AI_TEST_DB = "1";
    return { url: process.env.DATABASE_URL, ephemeral: false };
  }

  container = await new PostgreSqlContainer("postgres:17-alpine").start();
  const url = container.getConnectionUri();
  assertAiIsolatedDatabaseUrl(url);
  await runMigrations(url);
  process.env.DATABASE_URL = url;
  process.env.WANORA_AI_TEST_DB = "1";
  resetServerEnvCache();
  return { url, ephemeral: true };
}

try {
  const { url, ephemeral } = await resolveUrl();
  const isolation = checkAiIsolatedDatabaseUrl(url);
  const { db, pool } = createDb(url);

  const userId = randomUUID();
  const clientRequestId = randomUUID();
  const workerId = `mock-smoke-${randomUUID().slice(0, 8)}`;

  await db.insert(users).values({
    id: userId,
    name: "佐藤花子",
    email: `sato-hanako-mock-${userId.slice(0, 8)}@example.test`,
  });

  const conv = await createAiConversation(db, userId, {
    title: "Mock job smoke (fiction)",
  });

  const content =
    "私は社内IT担当として、業務システムの改善に携わってきました。主に要件整理、開発チームとの調整、テスト支援を担当しました。\n\n" +
    "上記の自己PRを、転職活動で使える自然なビジネス日本語に修正してください。事実にない経験や実績は追加しないでください。";

  const enq = await enqueueAiJob(db, {
    userId,
    conversationId: conv.id,
    clientRequestId,
    content,
    pageContext: { path: "/ja/my-career", area: "my_career" },
  });

  if (!enq.ok) {
    write(
      {
        ok: false,
        stage: "enqueue",
        code: enq.code,
        message: enq.message,
        isolation,
      },
      1,
    );
  } else {
    const claimed = await claimAiJobByIdForTest(db, {
      jobId: enq.job.id,
      workerId,
    });
    if (!claimed) {
      write(
        {
          ok: false,
          stage: "claim_by_id",
          jobId: enq.job.id,
          isolation,
        },
        1,
      );
    } else {
      const exec = await executeAiJob(db, {
        job: claimed,
        workerId,
        provider: createMockAiProvider(),
      });
      const fresh = await getAiJobById(db, enq.job.id);
      const [usage] = enq.job.usageEventId
        ? await db
            .select()
            .from(aiUsageEvents)
            .where(eq(aiUsageEvents.id, enq.job.usageEventId))
        : [];
      const budget = await getAiDailyBudgetCounter(db, "user", userId);

      const cleanup = await cleanupAiTestUserData(db, userId);

      write({
        ok: exec.ok === true && fresh?.status === "succeeded" && cleanup.ok,
        provider: "mock",
        openaiCalls: 0,
        ephemeralTestDb: ephemeral,
        isolation,
        jobId: enq.job.id,
        jobFinal: {
          status: fresh?.status ?? null,
          provider: fresh?.provider ?? null,
          providerOutcome: fresh?.providerOutcome ?? null,
        },
        usage: usage
          ? {
              status: usage.status,
              estimatedCostUsd: usage.estimatedCostUsd,
              pricingVersion: usage.pricingVersion,
            }
          : null,
        budget: budget
          ? { reservedUsd: budget.reservedUsd, spentUsd: budget.spentUsd }
          : null,
        cleanup,
        notes: [
          "Did not bulk-cancel queued/running jobs",
          "Did not use shared database name wanora",
          "Did not call OpenAI",
        ],
      });
    }
  }

  await pool.end();
} catch (err) {
  write(
    {
      ok: false,
      errorClass: err instanceof Error ? err.name : "Error",
      message: err instanceof Error ? err.message.slice(0, 500) : String(err),
      openaiCalls: 0,
    },
    1,
  );
} finally {
  await container?.stop();
}
