import { isAiEnabled, getServerEnv } from "@/lib/env";

/** Public AI capability probe for the sidebar (no secrets). */
export async function GET() {
  const env = getServerEnv();
  return Response.json({
    enabled: isAiEnabled(env),
    provider: env.AI_PROVIDER,
  });
}
