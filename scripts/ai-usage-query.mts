/**
 * Local CLI: inspect AI usage / Provider-call metadata (no prompt / resume / secrets).
 *
 * Examples (PowerShell / bash):
 *   pnpm ai:usage -- --request-id <clientRequestId>
 *   pnpm ai:usage -- --user-id <uuid> --date 2026-11-28
 *
 * Timezone for --date: Asia/Tokyo (YYYY-MM-DD).
 * Requires DATABASE_URL (loads .env.local when present).
 *
 * --request-id returns job + usage + inferred Provider calls for one 添削.
 * Note: ai_jobs.attempt = Worker claims; providerCallsInferred = actual Provider entry (0|1).
 * Day summary `callsWithTokens` ≠ Provider call count (see field docs / notes).
 */
import { getDb } from "../src/db";
import { getServerEnv } from "../src/lib/env";
import { summarizeAiUsageForUserDay } from "../src/lib/ai/usage";
import { inspectAiRequestByClientRequestId } from "../src/lib/ai/usage-inspect";

function usage() {
  console.error(`Usage:
  pnpm ai:usage -- --request-id <clientRequestId>
  pnpm ai:usage -- --user-id <uuid> --date YYYY-MM-DD

Notes:
  - --date is an Asia/Tokyo calendar day
  - Output is metadata only (tokens, cost estimate, status); never message bodies
  - estimatedCostUsd uses catalog pricing (not the vendor invoice)
  - workerClaimAttempts ≠ Provider calls; see inference.notes
  - callsWithTokens counts usage rows with tokens > 0, not Provider HTTP calls
`);
}

function parseArgs(argv: string[]) {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const val = argv[i + 1];
    if (!val || val.startsWith("--")) {
      out[key] = "true";
      continue;
    }
    out[key] = val;
    i += 1;
  }
  return out;
}

getServerEnv();

const args = parseArgs(process.argv.slice(2));
const requestId = args["request-id"]?.trim();
const userId = args["user-id"]?.trim();
const day = args.date?.trim();

if (args.help || args.h) {
  usage();
  process.exit(0);
}

const db = getDb();

if (requestId) {
  const inspect = await inspectAiRequestByClientRequestId(db, requestId);
  console.log(
    JSON.stringify(
      {
        ok: inspect.found,
        mode: "request-id",
        timezoneNote: "Asia/Tokyo for day queries",
        ...inspect,
      },
      null,
      2,
    ),
  );
  if (!inspect.found) process.exitCode = 1;
} else if (userId && day) {
  try {
    const summary = await summarizeAiUsageForUserDay(db, userId, day);
    console.log(
      JSON.stringify(
        {
          ok: true,
          mode: "user-day",
          summary,
          fieldNotes: {
            callsWithTokens:
              "Usage rows (ok/invalid_output/reserved) with token sum > 0 — not Provider HTTP call count.",
            jobsEnteredProvider:
              "Jobs that reached calling_provider / after_provider or left not_started (≤1 Provider call each).",
            workerClaimAttemptsSum:
              "Sum of ai_jobs.attempt (Worker claims/reclaims), not Provider calls.",
          },
        },
        null,
        2,
      ),
    );
  } catch (err) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          mode: "user-day",
          error: err instanceof Error ? err.message : String(err),
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  }
} else {
  usage();
  process.exitCode = 1;
}
