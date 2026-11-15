/**
 * External scheduler entry (cron): purge soft-deleted AI chats + reconcile.
 *
 *   pnpm ai:purge
 *
 * Requires DATABASE_URL and optionally AI_PURGE_SECRET is only for HTTP;
 * this CLI talks to the DB directly (ops machine / Cloud Run Job).
 */
import { getDb } from "../src/db";
import { getServerEnv } from "../src/lib/env";
import { purgeDeletedAiConversations } from "../src/lib/ai/jobs/purge";

getServerEnv();

const result = await purgeDeletedAiConversations(getDb());
console.log("[ai-purge]", result);
