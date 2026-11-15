import { connection } from "next/server";
import { headers } from "next/headers";
import { isAiEnabled } from "@/lib/env";
import { getSessionUser } from "@/lib/session";
import { AiSidebar } from "./ai-sidebar";

/**
 * Server gate: signed-in + AI_ENABLED. No API keys in the browser.
 * `connection()` marks this dynamic so `headers()` is safe when AI_ENABLED=true
 * during `next build` prerender of locale routes.
 */
export async function AiSidebarHost() {
  await connection();
  if (!isAiEnabled()) return null;
  const user = await getSessionUser(await headers());
  if (!user) return null;
  return <AiSidebar />;
}
