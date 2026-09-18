import { eq, and, isNull } from "drizzle-orm";
import { db, settings, assignments, type Settings } from "@/lib/db";
import { syncPlan } from "@/lib/reminders/sync";

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

export async function updateSettings(patch: Partial<Omit<Settings, "id" | "createdAt">>) {
  const [row] = await db
    .update(settings)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(settings.id, 1))
    .returning();

  await replanIncomplete();
  return row;
}

/** Settings feed every computed instant, so a change must rebuild future plans. */
export async function replanIncomplete() {
  const rows = await db
    .select({ id: assignments.id })
    .from(assignments)
    .where(and(isNull(assignments.deletedAt), isNull(assignments.completedAt)));

  for (const row of rows) {
    await syncPlan(row.id);
  }

  return rows.length;
}

export function serializeSettings(row: Settings) {
  return {
    timezone: row.timezone,
    quietEnabled: row.quietEnabled,
    quietStartLocal: row.quietStartLocal,
    quietEndLocal: row.quietEndLocal,
    substitutionStrategy: row.substitutionStrategy,
    substitutionTimeLocal: row.substitutionTimeLocal,
    allowDueTimeInQuiet: row.allowDueTimeInQuiet,
    dedupeWindowMinutes: row.dedupeWindowMinutes,
    pastReminderPolicy: row.pastReminderPolicy,
    overdueNudgeEnabled: row.overdueNudgeEnabled,
    overdueNudgeDelayMinutes: row.overdueNudgeDelayMinutes,
  };
}
