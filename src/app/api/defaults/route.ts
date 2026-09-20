import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { ok, route } from "@/lib/api";
import { db, defaultReminderRules } from "@/lib/db";
import { describeRule } from "@/lib/reminders/presets";
import { requireAppUser } from "@/lib/session";
import { ensureUserWorkspace } from "@/lib/workspace";

const ruleSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("offset"),
    offsetMinutes: z.number().int(),
    label: z.string().max(80).nullable().optional(),
    enabled: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal("time_of_day"),
    dayOffset: z.number().int(),
    timeLocal: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
    label: z.string().max(80).nullable().optional(),
    enabled: z.boolean().optional(),
  }),
]);

export const GET = route(async () => {
  const user = await requireAppUser();
  await ensureUserWorkspace(user.id);
  const rows = await db
    .select()
    .from(defaultReminderRules)
    .where(eq(defaultReminderRules.userId, user.id))
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

export const PUT = route(async (request: Request) => {
  const user = await requireAppUser();
  await ensureUserWorkspace(user.id);
  const { rules } = z.object({ rules: z.array(ruleSchema) }).parse(await request.json());

  await db.delete(defaultReminderRules).where(eq(defaultReminderRules.userId, user.id));

  if (rules.length > 0) {
    await db.insert(defaultReminderRules).values(
      rules.map((rule, index) =>
        rule.kind === "offset"
          ? {
              userId: user.id,
              kind: "offset" as const,
              offsetMinutes: rule.offsetMinutes,
              label: rule.label ?? null,
              enabled: rule.enabled ?? true,
              sortOrder: index,
            }
          : {
              userId: user.id,
              kind: "time_of_day" as const,
              dayOffset: rule.dayOffset,
              timeLocal: rule.timeLocal.length === 5 ? `${rule.timeLocal}:00` : rule.timeLocal,
              label: rule.label ?? null,
              enabled: rule.enabled ?? true,
              sortOrder: index,
            },
      ),
    );
  }

  const rows = await db
    .select()
    .from(defaultReminderRules)
    .where(eq(defaultReminderRules.userId, user.id))
    .orderBy(defaultReminderRules.sortOrder);

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
