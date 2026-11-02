import { inject } from "vitest";

process.env.DATABASE_URL = inject("databaseUrl");
process.env.AUTH_SECRET = "integration-test-secret-0123456789abcdef";
process.env.AUTH_URL = "http://localhost:3000";
delete process.env.AUTH_GOOGLE_CLIENT_ID;
delete process.env.AUTH_GOOGLE_CLIENT_SECRET;
