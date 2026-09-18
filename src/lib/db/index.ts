import "server-only";
import { Pool as NeonPool, neonConfig } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool as PgPool } from "pg";
import { env } from "@/lib/env";
import * as schema from "./schema";

export * from "./schema";
export { schema };

/**
 * The two drivers expose the same query builder, so the app is typed against
 * one of them. Neon's WebSocket pool is used in production (serverless-safe and
 * it supports interactive transactions, unlike Neon's HTTP driver), while plain
 * node-postgres is used for a local Postgres during development.
 */
export type Database = NodePgDatabase<typeof schema>;

function isNeonUrl(url: string): boolean {
  try {
    return /\.neon\.tech$|\.neon\.build$/.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

function createDatabase(): Database {
  const url = env.databaseUrl;

  if (isNeonUrl(url)) {
    // Neon's pooler terminates TLS itself; the driver needs no local WS shim on
    // Node 18+ because a global WebSocket is available.
    neonConfig.poolQueryViaFetch = true;
    return drizzleNeon({
      client: new NeonPool({ connectionString: url }),
      schema,
    }) as unknown as Database;
  }

  return drizzlePg({ client: new PgPool({ connectionString: url }), schema });
}

/**
 * Cached on the global object so Next's dev-mode module reloading doesn't open
 * a new pool on every edit.
 */
const globalForDb = globalThis as unknown as { __db?: Database };

export const db: Database = globalForDb.__db ?? createDatabase();

if (!env.isProduction) {
  globalForDb.__db = db;
}
