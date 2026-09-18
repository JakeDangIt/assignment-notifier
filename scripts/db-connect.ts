/**
 * Connection helper for one-off CLI scripts (migrate, seed).
 *
 * Scripts use plain node-postgres rather than the app's driver factory: they
 * run once in a normal Node process, so the serverless pooling story is
 * irrelevant, and this avoids pulling in `server-only` modules.
 */
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/lib/db/schema";

// Mirrors Next's precedence: .env.local wins over .env.
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

export function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local first.");
  }

  const pool = new Pool({ connectionString: url });
  const db = drizzle({ client: pool, schema });

  return { db, pool, schema };
}
