/**
 * Optional bootstrap for pre-tenancy rows, plus a no-op when there is nothing
 * to claim. New accounts get a settings row and starter defaults on first use
 * (`ensureUserWorkspace`); this script never creates a global singleton.
 *
 * If `MIGRATE_TO_USER_ID` is set to a Neon Auth user id, orphaned rows
 * (`user_id` IS NULL) are attached to that account. Otherwise they stay unused
 * so they cannot leak to every new friend who signs up.
 *
 * Usage: npm run db:seed
 */
import { eq, isNull, sql } from "drizzle-orm";
import { connect } from "./db-connect";
import { parseMigrateToUserId } from "../src/lib/tenancy";

async function main() {
  const { db, pool, schema } = connect();
  const migrateTo = parseMigrateToUserId(process.env);

  try {
    if (!migrateTo) {
      console.log(
        "No MIGRATE_TO_USER_ID set. Leaving unscoped rows unused. New users get their own workspace on first sign-in.",
      );
      return;
    }

    console.log(`Claiming pre-tenancy rows for user ${migrateTo}`);

    const existingSettings = await db.query.settings.findFirst({
      where: eq(schema.settings.userId, migrateTo),
    });
    if (existingSettings) {
      console.log("settings already exist for this user; leaving orphaned settings unused");
    } else {
      const claimed = await db
        .update(schema.settings)
        .set({ userId: migrateTo, updatedAt: new Date() })
        .where(isNull(schema.settings.userId))
        .returning({ id: schema.settings.id });
      console.log(`claimed ${claimed.length} settings row(s)`);
    }

    const existingDefaults = await db.query.defaultReminderRules.findFirst({
      where: eq(schema.defaultReminderRules.userId, migrateTo),
    });
    if (existingDefaults) {
      console.log("default reminder rules already exist for this user; leaving orphans unused");
    } else {
      const claimed = await db
        .update(schema.defaultReminderRules)
        .set({ userId: migrateTo, updatedAt: new Date() })
        .where(isNull(schema.defaultReminderRules.userId))
        .returning({ id: schema.defaultReminderRules.id });
      console.log(`claimed ${claimed.length} default reminder rule(s)`);
    }

    const assignments = await db
      .update(schema.assignments)
      .set({ userId: migrateTo, updatedAt: new Date() })
      .where(isNull(schema.assignments.userId))
      .returning({ id: schema.assignments.id });
    console.log(`claimed ${assignments.length} assignment(s)`);

    const push = await db
      .update(schema.pushSubscriptions)
      .set({ userId: migrateTo, updatedAt: new Date() })
      .where(isNull(schema.pushSubscriptions.userId))
      .returning({ id: schema.pushSubscriptions.id });
    console.log(`claimed ${push.length} push subscription(s)`);

    const scheduled = await db
      .update(schema.scheduledNotifications)
      .set({ userId: migrateTo, updatedAt: new Date() })
      .where(isNull(schema.scheduledNotifications.userId))
      .returning({ id: schema.scheduledNotifications.id });
    console.log(`claimed ${scheduled.length} scheduled notification(s)`);

    const [{ leftover }] = await db
      .select({ leftover: sql<number>`count(*)::int` })
      .from(schema.assignments)
      .where(isNull(schema.assignments.userId));
    console.log(`assignments still unscoped: ${leftover}`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
