import { eq, and, isNull } from "drizzle-orm";
import { db, settings, assignments, type Settings } from "@/lib/db";
import { syncPlan } from "@/lib/reminders/sync";
import { assertUserId } from "@/lib/tenancy";
import { ensureUserWorkspace } from "@/lib/workspace";

/**
 * One settings row per Neon Auth user, created on first request.
 * Reminder computation always reads this user's row — never a global default
 * and never another account's timezone/quiet hours.
 */
export async function getSettings(userId: string): Promise<Settings> {
  const id = assertUserId(userId);
  await ensureUserWorkspace(id);

  const row = await db.query.settings.findFirst({ where: eq(settings.userId, id) });
  if (!row) {
    throw new Error(`Settings row is missing for user ${id}.`);
  }
  return row;
}

export async function updateSettings(
  userId: string,
  patch: Partial<Omit<Settings, "id" | "userId" | "createdAt">>,
) {
  const id = assertUserId(userId);
  await ensureUserWorkspace(id);

  const [row] = await db
    .update(settings)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(settings.userId, id))
    .returning();

  if (!row) {
    throw new Error(`Settings row is missing for user ${id}.`);
  }
  await replanIncomplete(id);
  return row;
}

/** Settings feed every computed instant, so a change must rebuild future plans. */
export async function replanIncomplete(userId: string) {
  const id = assertUserId(userId);
  const rows = await db
    .select({ id: assignments.id })
    .from(assignments)
    .where(
      and(
        eq(assignments.userId, id),
        isNull(assignments.deletedAt),
        isNull(assignments.completedAt),
      ),
    );

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
