import { desc } from "drizzle-orm";
import { ok, route } from "@/lib/api";
import { db, defaultReminderRules } from "@/lib/db";
import { describeRule } from "@/lib/reminders/presets";

export const GET = route(async () => {
  const rows = await db
    .select()
    .from(defaultReminderRules)
    .orderBy(defaultReminderRules.sortOrder, desc(defaultReminderRules.createdAt));

  return ok({
    rules: rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      offsetMinutes: row.offsetMinutes,
      dayOffset: row.dayOffset,
      timeLocal: row.timeLocal,
      label: row.label ?? describeRule(row),
      enabled: row.enabled,
      sortOrder: row.sortOrder,
    })),
  });
});
