import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import {
  assignments,
  db,
  reminderRules,
  scheduledNotifications,
  type ScheduledNotification,
} from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { computePlan } from "@/lib/reminders";
import { toEngineRule, toEngineSettings } from "@/lib/reminders/map";
import { cancelScheduledMessage, enqueueNotification, isWithinHorizon } from "@/lib/scheduler";

const LIVE_STATUSES = ["pending", "enqueued", "failed"] as const;
const IMMUTABLE_STATUSES = ["sent", "sending"] as const;

function planKey(ruleId: string | null, reason: string | null): string {
  if (reason === "overdue_nudge") return "overdue_nudge";
  return ruleId ?? "unknown";
}

/**
 * Reconciles `scheduled_notifications` with a freshly computed plan.
 *
 * `sent` / `sending` rows are never touched. Everything else is canceled or
 * replaced so the table always matches the current due date, rules, and settings.
 */
export async function syncPlan(assignmentId: string, now = new Date()) {
  const [assignment] = await db
    .select()
    .from(assignments)
    .where(eq(assignments.id, assignmentId))
    .limit(1);

  if (!assignment?.userId) {
    await cancelLive(assignmentId);
    return { planned: [], stored: [] as ScheduledNotification[] };
  }

  const settings = await getSettings(assignment.userId);

  if (!assignment || assignment.completedAt || assignment.deletedAt) {
    await cancelLive(assignmentId);
    return { planned: [], stored: [] as ScheduledNotification[] };
  }

  const rules = await db
    .select()
    .from(reminderRules)
    .where(eq(reminderRules.assignmentId, assignmentId));

  const planned = computePlan({
    dueAt: assignment.dueAt,
    rules: rules.map(toEngineRule),
    settings: toEngineSettings(settings),
    now,
  });

  const existing = await db
    .select()
    .from(scheduledNotifications)
    .where(eq(scheduledNotifications.assignmentId, assignmentId));

  const live = existing.filter((row) =>
    (LIVE_STATUSES as readonly string[]).includes(row.status),
  );
  const immutableKeys = new Set(
    existing
      .filter((row) => (IMMUTABLE_STATUSES as readonly string[]).includes(row.status))
      .map((row) => planKey(row.ruleId, row.reason)),
  );

  const desired = planned.filter((item) => !item.skipped);
  const keepIds = new Set<string>();

  for (const row of live) {
    const key = planKey(row.ruleId, row.reason);
    const match = desired.find((item) => planKey(item.ruleId, item.reason) === key);

    if (!match) {
      await cancelRow(row);
      continue;
    }

    const sameInstant = Math.abs(row.fireAt.getTime() - match.fireAt.getTime()) < 1_000;
    if (sameInstant) {
      keepIds.add(key);
      continue;
    }

    await cancelRow(row);
  }

  const inserted: ScheduledNotification[] = [];

  for (const item of desired) {
    const key = planKey(item.ruleId, item.reason);
    if (keepIds.has(key) || immutableKeys.has(key)) continue;

    const [row] = await db
      .insert(scheduledNotifications)
      .values({
        assignmentId,
        userId: assignment.userId,
        ruleId: item.ruleId,
        fireAt: item.fireAt,
        originalFireAt: item.originalFireAt,
        status: "pending",
        reason: item.reason,
      })
      .returning();

    inserted.push(row);
    await maybeEnqueue(row, now);
  }

  const stored = await db
    .select()
    .from(scheduledNotifications)
    .where(eq(scheduledNotifications.assignmentId, assignmentId));

  return { planned, stored };
}

export async function cancelLive(assignmentId: string) {
  const rows = await db
    .select()
    .from(scheduledNotifications)
    .where(
      and(
        eq(scheduledNotifications.assignmentId, assignmentId),
        inArray(scheduledNotifications.status, [...LIVE_STATUSES]),
      ),
    );

  for (const row of rows) {
    await cancelRow(row);
  }
}

async function cancelRow(row: ScheduledNotification) {
  await cancelScheduledMessage(row.qstashMessageId);
  await db
    .update(scheduledNotifications)
    .set({ status: "canceled", updatedAt: new Date(), qstashMessageId: null })
    .where(
      and(
        eq(scheduledNotifications.id, row.id),
        inArray(scheduledNotifications.status, [...LIVE_STATUSES]),
      ),
    );
}

async function maybeEnqueue(row: ScheduledNotification, now: Date) {
  if (!isWithinHorizon(row.fireAt, now)) return;

  try {
    const result = await enqueueNotification(row.id, row.fireAt);
    if (!result.enqueued) return;

    await db
      .update(scheduledNotifications)
      .set({
        status: "enqueued",
        qstashMessageId: result.messageId,
        updatedAt: new Date(),
      })
      .where(and(eq(scheduledNotifications.id, row.id), eq(scheduledNotifications.status, "pending")));
  } catch (error) {
    console.error(`Failed to enqueue notification ${row.id}`, error);
  }
}

export async function replaceRules(
  assignmentId: string,
  rows: Array<{
    kind: "offset" | "time_of_day" | "absolute";
    offsetMinutes?: number | null;
    dayOffset?: number | null;
    timeLocal?: string | null;
    absoluteAt?: Date | null;
    label?: string | null;
    origin?: "default" | "manual";
    enabled?: boolean;
    sortOrder?: number;
  }>,
) {
  await db.delete(reminderRules).where(eq(reminderRules.assignmentId, assignmentId));

  if (rows.length === 0) return [];

  return db
    .insert(reminderRules)
    .values(
      rows.map((row, index) => ({
        assignmentId,
        kind: row.kind,
        offsetMinutes: row.offsetMinutes ?? null,
        dayOffset: row.dayOffset ?? null,
        timeLocal: row.timeLocal ?? null,
        absoluteAt: row.absoluteAt ?? null,
        label: row.label ?? null,
        origin: row.origin ?? "manual",
        enabled: row.enabled ?? true,
        sortOrder: row.sortOrder ?? index,
      })),
    )
    .returning();
}

export async function copyDefaultRules(assignmentId: string, userId: string) {
  const { defaultReminderRules } = await import("@/lib/db");
  const defaults = await db
    .select()
    .from(defaultReminderRules)
    .where(and(eq(defaultReminderRules.userId, userId), eq(defaultReminderRules.enabled, true)));

  return replaceRules(
    assignmentId,
    defaults.map((row) => ({
      kind: row.kind,
      offsetMinutes: row.offsetMinutes,
      dayOffset: row.dayOffset,
      timeLocal: row.timeLocal,
      label: row.label,
      origin: "default",
      enabled: row.enabled,
      sortOrder: row.sortOrder,
    })),
  );
}
