import { inject } from "vitest";
import { assertAiIsolatedDatabaseUrl } from "../../src/lib/ai/testing/database-url";

process.env.DATABASE_URL = inject("databaseUrl");
// Marker so resolveAiTestDatabaseUrl may use the injected Testcontainers URL.
process.env.WANORA_AI_TEST_DB = "1";
assertAiIsolatedDatabaseUrl(process.env.DATABASE_URL);
process.env.AUTH_SECRET = "integration-test-secret-0123456789abcdef";
process.env.AUTH_URL = "http://localhost:3000";
delete process.env.AUTH_GOOGLE_CLIENT_ID;
delete process.env.AUTH_GOOGLE_CLIENT_SECRET;
// Integration suites must stay on mock — never pay for OpenAI in CI.
process.env.AI_PROVIDER = "mock";
process.env.AI_LIVE_SMOKE = "false";
delete process.env.OPENAI_API_KEY;
