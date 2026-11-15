import { connection } from "next/server";
import { isAiEnabled, getServerEnv } from "@/lib/env";

/**
 * Public AI capability probe for the sidebar (no secrets).
 * `connection()` defers env reads until a real request — required with
 * Cache Components so `next build` (Docker) does not call getServerEnv().
 */
export async function GET() {
  await connection();
  const env = getServerEnv();
  return Response.json({
    enabled: isAiEnabled(env),
    provider: env.AI_PROVIDER,
  });
}
