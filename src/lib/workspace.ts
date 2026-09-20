import "server-only";
import { eq } from "drizzle-orm";
import { db, defaultReminderRules, settings } from "@/lib/db";
import { starterDefaultRuleValues } from "@/lib/reminders/presets";
import { assertUserId } from "@/lib/tenancy";

/**
 * Creates this user's settings row and starter default reminders on first use.
 *
 * A user who already has a settings row but zero default rules is treated as
 * having cleared them on purpose — we do not re-seed.
 */
export async function ensureUserWorkspace(userId: string) {
  const id = assertUserId(userId);

  const existing = await db.query.settings.findFirst({
    where: eq(settings.userId, id),
  });

  if (existing) return;

  await db.insert(settings).values({ userId: id }).onConflictDoNothing({
    target: settings.userId,
  });

  const existingRule = await db.query.defaultReminderRules.findFirst({
    where: eq(defaultReminderRules.userId, id),
  });
  if (existingRule) return;

  await db.insert(defaultReminderRules).values(starterDefaultRuleValues(id));
}
