import { and, count, eq, gte, sql } from "drizzle-orm";
import type { Db } from "@/db";
import {
  supportReports,
  type SupportNotifyStatus,
  type SupportReportCategory,
} from "@/db/schema";
import type { SupportDiagnostic } from "@/lib/support/types";

export type SupportReportRow = typeof supportReports.$inferSelect;

export type InsertSupportReportInput = {
  acceptanceNumber: string;
  clientSubmissionId: string;
  category: SupportReportCategory;
  message: string;
  replyEmail?: string | null;
  userId?: string | null;
  diagnostic: SupportDiagnostic | Record<string, unknown>;
  rateLimitKey: string;
  notifyStatus?: SupportNotifyStatus;
};

export async function findSupportReportByClientSubmissionId(
  db: Db,
  clientSubmissionId: string,
): Promise<SupportReportRow | null> {
  const [row] = await db
    .select()
    .from(supportReports)
    .where(eq(supportReports.clientSubmissionId, clientSubmissionId))
    .limit(1);
  return row ?? null;
}

export async function findSupportReportByAcceptanceNumber(
  db: Db,
  acceptanceNumber: string,
): Promise<SupportReportRow | null> {
  const [row] = await db
    .select()
    .from(supportReports)
    .where(eq(supportReports.acceptanceNumber, acceptanceNumber))
    .limit(1);
  return row ?? null;
}

export async function insertSupportReport(
  db: Db,
  input: InsertSupportReportInput,
): Promise<SupportReportRow> {
  const [row] = await db
    .insert(supportReports)
    .values({
      acceptanceNumber: input.acceptanceNumber,
      clientSubmissionId: input.clientSubmissionId,
      category: input.category,
      message: input.message,
      replyEmail: input.replyEmail ?? null,
      userId: input.userId ?? null,
      diagnostic: input.diagnostic,
      rateLimitKey: input.rateLimitKey,
      notifyStatus: input.notifyStatus ?? "pending",
    })
    .returning();
  if (!row) throw new Error("insert_support_report_failed");
  return row;
}

export async function countSupportReportsSince(
  db: Db,
  rateLimitKey: string,
  since: Date,
): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(supportReports)
    .where(
      and(
        eq(supportReports.rateLimitKey, rateLimitKey),
        gte(supportReports.createdAt, since),
      ),
    );
  return Number(row?.n ?? 0);
}

export async function updateSupportNotifyStatus(
  db: Db,
  id: string,
  patch: {
    notifyStatus: SupportNotifyStatus;
    notifyAttempts: number;
    notifyLastError?: string | null;
    notifySentAt?: Date | null;
  },
): Promise<SupportReportRow | null> {
  const [row] = await db
    .update(supportReports)
    .set({
      notifyStatus: patch.notifyStatus,
      notifyAttempts: patch.notifyAttempts,
      notifyLastError: patch.notifyLastError ?? null,
      notifySentAt: patch.notifySentAt ?? null,
      updatedAt: new Date(),
    })
    .where(eq(supportReports.id, id))
    .returning();
  return row ?? null;
}

/** Advisory lock scoped to a rate-limit key (anonymous IP hash or user id). */
export async function withSupportRateLock<T>(
  db: Db,
  rateLimitKey: string,
  fn: () => Promise<T>,
): Promise<T> {
  await db.execute(
    sql`select pg_advisory_xact_lock(
      hashtext('wanora:support:rate'),
      hashtext(${rateLimitKey})
    )`,
  );
  return fn();
}
