/**
 * Creates the singleton settings row and a starter default reminder set.
 *
 * Idempotent: safe to re-run against an existing database.
 *
 * Usage: npm run db:seed
 */
import { sql } from "drizzle-orm";
import { connect } from "./db-connect";
import { presetById, STARTER_DEFAULT_RULE_IDS } from "../src/lib/reminders/presets";

async function main() {
  const { db, pool, schema } = connect();

  try {
    await db
      .insert(schema.settings)
      .values({ id: 1 })
      .onConflictDoNothing({ target: schema.settings.id });
    console.log("settings row ready");

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.defaultReminderRules);

    if (count > 0) {
      console.log(`default reminder rules already present (${count}); leaving them alone`);
      return;
    }

    const rows = STARTER_DEFAULT_RULE_IDS.map((id, index) => {
      const preset = presetById(id);
      if (!preset) throw new Error(`Unknown preset id "${id}"`);

      return {
        kind: preset.spec.kind,
        offsetMinutes: preset.spec.kind === "offset" ? preset.spec.offsetMinutes : null,
        dayOffset: preset.spec.kind === "time_of_day" ? preset.spec.dayOffset : null,
        timeLocal: preset.spec.kind === "time_of_day" ? preset.spec.timeLocal : null,
        label: preset.label,
        sortOrder: index,
      };
    });

    await db.insert(schema.defaultReminderRules).values(rows);
    console.log(
      `seeded ${rows.length} default reminder rules: ${rows.map((r) => r.label).join(", ")}`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
