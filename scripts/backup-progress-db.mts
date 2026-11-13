import { mkdirSync, writeFileSync } from "node:fs";
import pg from "pg";

const url =
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/wanora";
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
mkdirSync("backups", { recursive: true });
const outPath = `backups/wanora-pre-progress-ui-${stamp}.json`;

const client = new pg.Client({ connectionString: url });
await client.connect();

const tables = [
  "companies",
  "applications",
  "application_stages",
  "interviews",
  "interview_feedbacks",
  "slot_proposals",
  "proposed_slots",
  "recruiters",
  "platforms",
] as const;

const out: Record<string, unknown> = {
  meta: { at: stamp, note: "pre progress-ui-redesign backup; no drops" },
};

for (const table of tables) {
  try {
    const result = await client.query(`select * from ${table}`);
    out[table] = result.rows;
  } catch (error) {
    out[table] = { error: String(error) };
  }
}

writeFileSync(outPath, JSON.stringify(out, null, 2));
const counts = Object.fromEntries(
  tables.map((t) => [
    t,
    Array.isArray(out[t]) ? (out[t] as unknown[]).length : out[t],
  ]),
);
console.log(JSON.stringify({ outPath, counts }, null, 2));
await client.end();
