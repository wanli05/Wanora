import type { SupportReportRow } from "@/lib/data/support-reports";
import { getServerEnv } from "@/lib/env";

export type SupportNotifyPayload = {
  acceptanceNumber: string;
  category: string;
  createdAt: string;
  module?: string;
  operation?: string;
  errorCode?: string;
  faultId?: string;
  appVersion?: string;
};

/** Build maintainer-safe payload — never includes message / replyEmail / user PII. */
export function buildSupportNotifyPayload(
  row: SupportReportRow,
): SupportNotifyPayload {
  const d =
    row.diagnostic && typeof row.diagnostic === "object"
      ? (row.diagnostic as Record<string, unknown>)
      : {};
  return {
    acceptanceNumber: row.acceptanceNumber,
    category: row.category,
    createdAt: row.createdAt.toISOString(),
    module: typeof d.module === "string" ? d.module : undefined,
    operation: typeof d.operation === "string" ? d.operation : undefined,
    errorCode: typeof d.errorCode === "string" ? d.errorCode : undefined,
    faultId: typeof d.faultId === "string" ? d.faultId : undefined,
    appVersion: typeof d.appVersion === "string" ? d.appVersion : undefined,
  };
}

export type NotifyResult =
  | { ok: true; provider: string }
  | { ok: false; provider: string; error: string };

/**
 * Send maintainer notification.
 * Providers: `log` (default / CI), `webhook` (POST JSON to SUPPORT_NOTIFY_WEBHOOK_URL).
 */
export async function sendSupportMaintainerNotify(
  row: SupportReportRow,
): Promise<NotifyResult> {
  const env = getServerEnv();
  const provider = env.SUPPORT_NOTIFY_PROVIDER;
  const payload = buildSupportNotifyPayload(row);

  if (provider === "log") {
    console.info(
      JSON.stringify({ kind: "support_notify", provider: "log", ...payload }),
    );
    return { ok: true, provider: "log" };
  }

  if (provider === "webhook") {
    const url = env.SUPPORT_NOTIFY_WEBHOOK_URL;
    if (!url) {
      return {
        ok: false,
        provider: "webhook",
        error: "SUPPORT_NOTIFY_WEBHOOK_URL missing",
      };
    }
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(env.SUPPORT_NOTIFY_WEBHOOK_TOKEN
            ? {
                authorization: `Bearer ${env.SUPPORT_NOTIFY_WEBHOOK_TOKEN}`,
              }
            : {}),
        },
        body: JSON.stringify({
          text: [
            `[Wanora] お問い合わせ受付 ${payload.acceptanceNumber}`,
            `category=${payload.category}`,
            `at=${payload.createdAt}`,
            payload.module ? `module=${payload.module}` : null,
            payload.operation ? `operation=${payload.operation}` : null,
            payload.errorCode ? `errorCode=${payload.errorCode}` : null,
            payload.faultId ? `faultId=${payload.faultId}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
          ...payload,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        return {
          ok: false,
          provider: "webhook",
          error: `webhook_http_${res.status}`,
        };
      }
      return { ok: true, provider: "webhook" };
    } catch (err) {
      return {
        ok: false,
        provider: "webhook",
        error: err instanceof Error ? err.message.slice(0, 160) : "webhook_failed",
      };
    }
  }

  return { ok: false, provider, error: `unknown_provider:${provider}` };
}
