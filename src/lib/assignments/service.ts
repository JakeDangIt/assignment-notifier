import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db, assignments, reminderRules, scheduledNotifications, type Assignment } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { parseLocalDateTime } from "@/lib/time";
import { copyDefaultRules, replaceRules, syncPlan } from "@/lib/reminders/sync";
import { computePlan } from "@/lib/reminders";
import { toEngineRule, toEngineSettings } from "@/lib/reminders/map";

export const ruleInputSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("offset"),
    offsetMinutes: z.number().int(),
    label: z.string().max(80).nullable().optional(),
    origin: z.enum(["default", "manual"]).optional(),
    enabled: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal("time_of_day"),
    dayOffset: z.number().int(),
    timeLocal: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
    label: z.string().max(80).nullable().optional(),
    origin: z.enum(["default", "manual"]).optional(),
    enabled: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal("absolute"),
    absoluteAtLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
    label: z.string().max(80).nullable().optional(),
    origin: z.enum(["default", "manual"]).optional(),
    enabled: z.boolean().optional(),
  }),
]);

export const assignmentWriteSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).optional().nullable(),
  className: z.string().trim().max(120).optional().nullable(),
  /**
   * Wall-clock due time in the settings timezone, as `YYYY-MM-DDTHH:mm`.
   * Converted to UTC on the server so the client never has to know offsets.
   */
  dueAtLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
  /** When omitted, the user's default reminder set is copied in. */
  rules: z.array(ruleInputSchema).optional(),
});

export type AssignmentWrite = z.infer<typeof assignmentWriteSchema>;
export type RuleInput = z.infer<typeof ruleInputSchema>;

export function toAssignmentDTO(row: Assignment) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    className: row.className,
    dueAt: row.dueAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listAssignments() {
  const rows = await db
    .select()
    .from(assignments)
    .where(isNull(assignments.deletedAt))
    .orderBy(assignments.dueAt, desc(assignments.createdAt));

  return rows.map(toAssignmentDTO);
}

export async function getAssignment(id: string) {
  const [row] = await db
    .select()
    .from(assignments)
    .where(and(eq(assignments.id, id), isNull(assignments.deletedAt)))
    .limit(1);

  return row ?? null;
}

export async function createAssignment(input: AssignmentWrite) {
  const settings = await getSettings();
  const dueAt = parseLocalDateTime(input.dueAtLocal, settings.timezone);

  const [row] = await db
    .insert(assignments)
    .values({
      title: input.title,
      description: emptyToNull(input.description),
      className: emptyToNull(input.className),
      dueAt,
    })
    .returning();

  if (input.rules) {
    await persistRules(row.id, input.rules, settings.timezone);
  } else {
    await copyDefaultRules(row.id);
  }

  await syncPlan(row.id);
  return row;
}

export async function updateAssignment(id: string, input: AssignmentWrite) {
  const existing = await getAssignment(id);
  if (!existing) return null;

  const settings = await getSettings();
  const dueAt = parseLocalDateTime(input.dueAtLocal, settings.timezone);

  const [row] = await db
    .update(assignments)
    .set({
      title: input.title,
      description: emptyToNull(input.description),
      className: emptyToNull(input.className),
      dueAt,
      updatedAt: new Date(),
    })
    .where(eq(assignments.id, id))
    .returning();

  if (input.rules) {
    await persistRules(id, input.rules, settings.timezone);
  }

  await syncPlan(id);
  return row;
}

export async function completeAssignment(id: string, completed: boolean) {
  const existing = await getAssignment(id);
  if (!existing) return null;

  const [row] = await db
    .update(assignments)
    .set({
      completedAt: completed ? (existing.completedAt ?? new Date()) : null,
      updatedAt: new Date(),
    })
    .where(eq(assignments.id, id))
    .returning();

  await syncPlan(id);
  return row;
}

export async function softDeleteAssignment(id: string) {
  const existing = await getAssignment(id);
  if (!existing) return null;

  const [row] = await db
    .update(assignments)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(assignments.id, id))
    .returning();

  await syncPlan(id);
  return row;
}

export async function getAssignmentDetails(id: string) {
  const row = await getAssignment(id);
  if (!row) return null;

  const settings = await getSettings();
  const rules = await db
    .select()
    .from(reminderRules)
    .where(eq(reminderRules.assignmentId, id));

  const planned = computePlan({
    dueAt: row.dueAt,
    rules: rules.map(toEngineRule),
    settings: toEngineSettings(settings),
    now: new Date(),
  });

  const scheduled = await db
    .select()
    .from(scheduledNotifications)
    .where(eq(scheduledNotifications.assignmentId, id));

  return {
    assignment: toAssignmentDTO(row),
    rules: rules.map((rule) => ({
      id: rule.id,
      kind: rule.kind,
      offsetMinutes: rule.offsetMinutes,
      dayOffset: rule.dayOffset,
      timeLocal: rule.timeLocal,
      absoluteAt: rule.absoluteAt?.toISOString() ?? null,
      label: rule.label,
      origin: rule.origin,
      enabled: rule.enabled,
      sortOrder: rule.sortOrder,
    })),
    planned: planned.map((item) => ({
      ruleId: item.ruleId,
      fireAt: item.fireAt.toISOString(),
      originalFireAt: item.originalFireAt.toISOString(),
      reason: item.reason,
      origin: item.origin,
      skipped: item.skipped,
      label: item.label,
    })),
    scheduled: scheduled.map((item) => ({
      id: item.id,
      fireAt: item.fireAt.toISOString(),
      originalFireAt: item.originalFireAt?.toISOString() ?? null,
      status: item.status,
      reason: item.reason,
    })),
    timezone: settings.timezone,
  };
}

async function persistRules(assignmentId: string, rules: RuleInput[], timezone: string) {
  await replaceRules(
    assignmentId,
    rules.map((rule, index) => {
      if (rule.kind === "offset") {
        return {
          kind: "offset" as const,
          offsetMinutes: rule.offsetMinutes,
          label: rule.label,
          origin: rule.origin,
          enabled: rule.enabled,
          sortOrder: index,
        };
      }
      if (rule.kind === "time_of_day") {
        return {
          kind: "time_of_day" as const,
          dayOffset: rule.dayOffset,
          timeLocal: normalizeTime(rule.timeLocal),
          label: rule.label,
          origin: rule.origin,
          enabled: rule.enabled,
          sortOrder: index,
        };
      }
      return {
        kind: "absolute" as const,
        absoluteAt: parseLocalDateTime(rule.absoluteAtLocal, timezone),
        label: rule.label ?? "Custom time",
        origin: rule.origin ?? "manual",
        enabled: rule.enabled,
        sortOrder: index,
      };
    }),
  );
}

function normalizeTime(value: string): string {
  return value.length === 5 ? `${value}:00` : value;
}

function emptyToNull(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
