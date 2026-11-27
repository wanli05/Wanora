#!/usr/bin/env node
/**
 * Maintainer CLI: look up a support report by 受理编号 and optionally retry notify.
 *
 * Usage:
 *   pnpm support:lookup WR-20261126-A1B2C3
 *   pnpm support:lookup WR-20261126-A1B2C3 --retry-notify
 *
 * Prints diagnostic fields + notify status. Message / reply email are shown
 * only on this local CLI (never in HTTP APIs, logs, or maintainer webhooks).
 */
import { getDb } from "../src/db";
import { findSupportReportByAcceptanceNumber } from "../src/lib/data/support-reports";
import {
  buildSupportNotifyPayload,
  retrySupportNotify,
} from "../src/lib/support";

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--");
  const retry = args.includes("--retry-notify");
  const acceptance = args.find((a) => !a.startsWith("--"));
  if (!acceptance) {
    console.error(
      "Usage: pnpm support:lookup <acceptanceNumber> [--retry-notify]",
    );
    process.exit(2);
  }

  const db = getDb();
  let row = await findSupportReportByAcceptanceNumber(db, acceptance);
  if (!row) {
    console.error(`not found: ${acceptance}`);
    process.exit(1);
  }

  if (retry) {
    row = (await retrySupportNotify(db, acceptance)) ?? row;
  }

  const safe = buildSupportNotifyPayload(row);
  console.log(
    JSON.stringify(
      {
        acceptanceNumber: row.acceptanceNumber,
        category: row.category,
        createdAt: row.createdAt.toISOString(),
        notifyStatus: row.notifyStatus,
        notifyAttempts: row.notifyAttempts,
        notifyLastError: row.notifyLastError,
        notifySentAt: row.notifySentAt?.toISOString() ?? null,
        userIdPresent: Boolean(row.userId),
        diagnostic: row.diagnostic,
        notifySafePayload: safe,
        // Local maintainer-only fields (not emitted by notify / public API):
        message: row.message,
        replyEmail: row.replyEmail,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
