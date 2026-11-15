import { getDb } from "@/db";
import { aiError } from "@/lib/ai/conversation/http";
import { purgeDeletedAiConversations } from "@/lib/ai/jobs/purge";
import { getServerEnv } from "@/lib/env";

/**
 * External scheduler endpoint (cron / Cloud Scheduler).
 * Auth: `Authorization: Bearer <AI_PURGE_SECRET>` or `x-ai-purge-secret`.
 * Not available to ordinary session users.
 */
export async function POST(request: Request) {
  const env = getServerEnv();
  if (!env.AI_PURGE_SECRET) {
    return aiError("ai_unavailable", 503, "AI_PURGE_SECRET is not configured");
  }

  const header =
    request.headers.get("x-ai-purge-secret") ??
    request.headers.get("authorization");
  const token = header?.startsWith("Bearer ")
    ? header.slice("Bearer ".length).trim()
    : header?.trim();

  if (!token || token !== env.AI_PURGE_SECRET) {
    return aiError("unauthorized", 401, "invalid purge secret");
  }

  const result = await purgeDeletedAiConversations(getDb());
  return Response.json({ ok: true, ...result });
}
