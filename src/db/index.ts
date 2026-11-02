import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getServerEnv } from "@/lib/env";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;

export function createDb(connectionString: string): { db: Db; pool: Pool } {
  const pool = new Pool({ connectionString, max: 5 });
  return { db: drizzle(pool, { schema }), pool };
}

let instance: Db | undefined;

export function getDb(): Db {
  instance ??= createDb(getServerEnv().DATABASE_URL).db;
  return instance;
}
