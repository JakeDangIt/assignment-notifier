import { eq } from "drizzle-orm";
import { db, settings, type Settings } from "@/lib/db";

/**
 * The settings row is a singleton (id = 1), created by the seed script. Every
 * reminder computation reads it, so a missing row is a setup error, not a
 * "use defaults" situation — silent defaults would hide a failed migration.
 */
export async function getSettings(): Promise<Settings> {
  const row = await db.query.settings.findFirst({ where: eq(settings.id, 1) });
  if (!row) {
    throw new Error("Settings row is missing. Run `npm run db:seed`.");
  }
  return row;
}
