import { headers } from "next/headers";
import { isAiEnabled } from "@/lib/env";
import { getSessionUser } from "@/lib/session";
import { AiSidebar } from "./ai-sidebar";

/** Server gate: signed-in + AI_ENABLED. No API keys in the browser. */
export async function AiSidebarHost() {
  if (!isAiEnabled()) return null;
  const user = await getSessionUser(await headers());
  if (!user) return null;
  return <AiSidebar />;
}
