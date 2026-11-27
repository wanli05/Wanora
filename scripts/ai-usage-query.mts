/**
 * Local CLI: inspect AI usage metadata (no prompt / resume body / secrets).
 *
 * Examples (PowerShell / bash):
 *   pnpm ai:usage -- --request-id <clientRequestId>
 *   pnpm ai:usage -- --user-id <uuid> --date 2026-11-28
 *
 * Timezone for --date: Asia/Tokyo (YYYY-MM-DD).
 * Requires DATABASE_URL (loads .env.local when present).
 */
import { getDb } from "../src/db";
import { getServerEnv } from "../src/lib/env";
import {
  findAiUsageByRequestIdAnyUser,
  serializeAiUsageMeta,
  summarizeAiUsageForUserDay,
} from "../src/lib/ai/usage";

function usage() {
  console.error(`Usage:
  pnpm ai:usage -- --request-id <clientRequestId>
  pnpm ai:usage -- --user-id <uuid> --date YYYY-MM-DD

Notes:
  - --date is an Asia/Tokyo calendar day
  - Output is metadata only (tokens, cost estimate, status); never message bodies
  - estimatedCostUsd uses catalog pricing (not the vendor invoice)
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
  const row = await findAiUsageByRequestIdAnyUser(db, requestId);
  if (!row) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          mode: "request-id",
          requestId,
          error: "not_found",
          timezoneNote: "Asia/Tokyo for day queries",
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  } else {
    console.log(
      JSON.stringify(
        {
          ok: true,
          mode: "request-id",
          timezoneNote: "Asia/Tokyo for day queries",
          usage: serializeAiUsageMeta(row),
        },
        null,
        2,
      ),
    );
  }
} else if (userId && day) {
  try {
    const summary = await summarizeAiUsageForUserDay(db, userId, day);
    console.log(
      JSON.stringify(
        {
          ok: true,
          mode: "user-day",
          summary,
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
