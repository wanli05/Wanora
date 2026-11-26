import type { Db } from "@/db";
import { APP_VERSION } from "@/lib/app-version";
import {
  countSupportReportsSince,
  findSupportReportByAcceptanceNumber,
  findSupportReportByClientSubmissionId,
  insertSupportReport,
  updateSupportNotifyStatus,
  withSupportRateLock,
  type SupportReportRow,
} from "@/lib/data/support-reports";
import { generateAcceptanceNumber } from "@/lib/support/acceptance-number";
import { sendSupportMaintainerNotify } from "@/lib/support/notify";
import type {
  SubmitSupportReportBody,
  SupportDiagnostic,
} from "@/lib/support/types";
import { getServerEnv } from "@/lib/env";

export type SubmitSupportReportResult =
  | {
      ok: true;
      acceptanceNumber: string;
      replayed: boolean;
      notifyStatus: SupportReportRow["notifyStatus"];
    }
  | {
      ok: false;
      code: "rate_limited" | "invalid" | "unavailable";
      message: string;
    };

function normalizeDiagnostic(
  diagnostic: SupportDiagnostic | undefined,
): SupportDiagnostic {
  const base: SupportDiagnostic = diagnostic ?? {
    module: "general",
    operation: "manual_contact",
    routeId: "contact",
    source: "manual",
  };
  return {
    ...base,
    occurredAt: base.occurredAt ?? new Date().toISOString(),
    appVersion: base.appVersion ?? APP_VERSION,
  };
}

async function attemptNotify(
  db: Db,
  row: SupportReportRow,
): Promise<SupportReportRow> {
  const env = getServerEnv();
  const maxAttempts = env.SUPPORT_NOTIFY_MAX_ATTEMPTS;
  if (row.notifyStatus === "sent") return row;

  const result = await sendSupportMaintainerNotify(row);
  const attempts = row.notifyAttempts + 1;
  if (result.ok) {
    const updated = await updateSupportNotifyStatus(db, row.id, {
      notifyStatus: "sent",
      notifyAttempts: attempts,
      notifyLastError: null,
      notifySentAt: new Date(),
    });
    return updated ?? row;
  }

  const status = attempts >= maxAttempts ? "failed" : "pending";
  const updated = await updateSupportNotifyStatus(db, row.id, {
    notifyStatus: status,
    notifyAttempts: attempts,
    notifyLastError: result.error.slice(0, 200),
    notifySentAt: null,
  });
  return updated ?? row;
}

/**
 * Persist a support report with idempotency + rate limit.
 * Notification runs after commit; failure does not roll back acceptance.
 */
export async function submitSupportReport(
  db: Db,
  input: {
    body: SubmitSupportReportBody;
    userId?: string | null;
    rateLimitKey: string;
  },
): Promise<SubmitSupportReportResult> {
  const env = getServerEnv();
  if (!env.SUPPORT_REPORTS_ENABLED) {
    return {
      ok: false,
      code: "unavailable",
      message: "support reports disabled",
    };
  }

  const existing = await findSupportReportByClientSubmissionId(
    db,
    input.body.clientSubmissionId,
  );
  if (existing) {
    let row = existing;
    if (existing.notifyStatus !== "sent") {
      row = await attemptNotify(db, existing);
    }
    return {
      ok: true,
      acceptanceNumber: row.acceptanceNumber,
      replayed: true,
      notifyStatus: row.notifyStatus,
    };
  }

  const diagnostic = normalizeDiagnostic(input.body.diagnostic);

  type TxResult = { row: SupportReportRow; replayed: boolean };
  let created: TxResult;
  try {
    created = await db.transaction(async (tx) => {
      return withSupportRateLock(tx, input.rateLimitKey, async () => {
        const again = await findSupportReportByClientSubmissionId(
          tx,
          input.body.clientSubmissionId,
        );
        if (again) return { row: again, replayed: true };

        const since = new Date(Date.now() - 60 * 60 * 1000);
        const current = await countSupportReportsSince(
          tx,
          input.rateLimitKey,
          since,
        );
        if (current >= env.SUPPORT_REPORT_RATE_LIMIT_PER_HOUR) {
          throw Object.assign(new Error("rate_limited"), {
            code: "rate_limited",
          });
        }

        let lastErr: unknown;
        for (let i = 0; i < 5; i++) {
          try {
            const row = await insertSupportReport(tx, {
              acceptanceNumber: generateAcceptanceNumber(),
              clientSubmissionId: input.body.clientSubmissionId,
              category: input.body.category,
              message: input.body.message,
              replyEmail: input.body.replyEmail ?? null,
              userId: input.userId ?? null,
              diagnostic,
              rateLimitKey: input.rateLimitKey,
              notifyStatus: "pending",
            });
            return { row, replayed: false };
          } catch (err) {
            lastErr = err;
            const code =
              err && typeof err === "object" && "code" in err
                ? String((err as { code: unknown }).code)
                : "";
            if (code === "23505") {
              const raced = await findSupportReportByClientSubmissionId(
                tx,
                input.body.clientSubmissionId,
              );
              if (raced) return { row: raced, replayed: true };
              continue;
            }
            throw err;
          }
        }
        throw lastErr instanceof Error
          ? lastErr
          : new Error("acceptance_number_collision");
      });
    });
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "rate_limited"
    ) {
      return {
        ok: false,
        code: "rate_limited",
        message: "too many reports",
      };
    }
    const raced = await findSupportReportByClientSubmissionId(
      db,
      input.body.clientSubmissionId,
    );
    if (raced) {
      return {
        ok: true,
        acceptanceNumber: raced.acceptanceNumber,
        replayed: true,
        notifyStatus: raced.notifyStatus,
      };
    }
    throw err;
  }

  let row = created.row;
  if (!created.replayed || row.notifyStatus !== "sent") {
    row = await attemptNotify(db, row);
  }

  return {
    ok: true,
    acceptanceNumber: row.acceptanceNumber,
    replayed: created.replayed,
    notifyStatus: row.notifyStatus,
  };
}

/** Retry notify for an existing acceptance number (CLI / ops). */
export async function retrySupportNotify(
  db: Db,
  acceptanceNumber: string,
): Promise<SupportReportRow | null> {
  const row = await findSupportReportByAcceptanceNumber(db, acceptanceNumber);
  if (!row) return null;
  return attemptNotify(db, row);
}
