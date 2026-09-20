import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * All instants are stored as `timestamptz` (UTC). Wall-clock reasoning -- due
 * times, quiet hours, "9 PM the night before" -- happens in the IANA timezone
 * configured on that user's `settings.timezone` row, never in the database.
 *
 * Tenant-owned tables carry `user_id` (Neon Auth user id, not email). Null
 * means a pre-tenancy orphan; app queries always filter by the signed-in id,
 * so orphans never leak to new accounts.
 */

const createdAt = timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();
/** Neon Auth `user.id`. Nullable only for leftover global rows. */
const userId = text("user_id");

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/**
 * How a reminder rule resolves to an instant:
 *  - `offset`: due_at minus N minutes ("3 hours before")
 *  - `time_of_day`: a local clock time on a day relative to the due date
 *    ("morning of" = day 0 at 09:00; "night before" = day -1 at 21:00)
 *  - `absolute`: a fixed timestamp the user picked outright
 */
export const ruleKindEnum = pgEnum("rule_kind", ["offset", "time_of_day", "absolute"]);

/** Whether a rule came from the user's default set or was added by hand. */
export const ruleOriginEnum = pgEnum("rule_origin", ["default", "manual"]);

/**
 * Lifecycle of a single planned notification.
 *
 * `pending` -> `enqueued` (handed to QStash) -> `sending` (claimed by a
 * delivery attempt) -> `sent` | `failed`. `canceled` covers edits, completion
 * and deletion; `skipped` marks reminders the engine intentionally dropped.
 */
export const notificationStatusEnum = pgEnum("notification_status", [
  "pending",
  "enqueued",
  "sending",
  "sent",
  "failed",
  "canceled",
  "skipped",
]);

/** Why the engine moved or dropped a reminder, for display and debugging. */
export const notificationReasonEnum = pgEnum("notification_reason", [
  "quiet_hours_substituted",
  "quiet_hours_dropped",
  "deduped",
  "past_coalesced",
  "past_skipped",
  "overdue_nudge",
]);

export const deliveryStatusEnum = pgEnum("delivery_status", ["sent", "failed", "expired"]);

/** Named strategies for relocating a reminder that lands inside quiet hours. */
export const substitutionStrategyEnum = pgEnum("substitution_strategy", [
  "evening_before",
  "shift_to_quiet_end",
  "drop",
]);

/** What to do with a reminder whose computed time has already passed. */
export const pastPolicyEnum = pgEnum("past_reminder_policy", ["fire_now", "skip"]);

// ---------------------------------------------------------------------------
// Settings (one row per user)
// ---------------------------------------------------------------------------

export const settings = pgTable(
  "settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId,
    timezone: text("timezone").notNull().default("America/New_York"),

    quietEnabled: boolean("quiet_enabled").notNull().default(true),
    quietStartLocal: time("quiet_start_local").notNull().default("00:00:00"),
    quietEndLocal: time("quiet_end_local").notNull().default("07:00:00"),
    substitutionStrategy: substitutionStrategyEnum("substitution_strategy")
      .notNull()
      .default("evening_before"),
    substitutionTimeLocal: time("substitution_time_local").notNull().default("21:00:00"),
    /** Allow an "at due time" reminder to fire even inside quiet hours. */
    allowDueTimeInQuiet: boolean("allow_due_time_in_quiet").notNull().default(true),

    dedupeWindowMinutes: integer("dedupe_window_minutes").notNull().default(15),
    pastReminderPolicy: pastPolicyEnum("past_reminder_policy").notNull().default("fire_now"),

    overdueNudgeEnabled: boolean("overdue_nudge_enabled").notNull().default(true),
    overdueNudgeDelayMinutes: integer("overdue_nudge_delay_minutes").notNull().default(60),

    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("settings_user_id_idx").on(table.userId),
    check("settings_dedupe_window_nonneg", sql`${table.dedupeWindowMinutes} >= 0`),
    check("settings_overdue_delay_nonneg", sql`${table.overdueNudgeDelayMinutes} >= 0`),
  ],
);

// ---------------------------------------------------------------------------
// Reminder rules
// ---------------------------------------------------------------------------

/**
 * Enforces that exactly the columns belonging to a rule's `kind` are populated.
 * Shared by the per-assignment rules and the user's default set so the two
 * stay structurally identical -- applying defaults is then a plain row copy.
 */
function ruleKindShapeCheck(name: string, table: {
  kind: unknown;
  offsetMinutes: unknown;
  dayOffset: unknown;
  timeLocal: unknown;
}) {
  return check(
    name,
    sql`(
      (${table.kind} = 'offset' AND ${table.offsetMinutes} IS NOT NULL
        AND ${table.dayOffset} IS NULL AND ${table.timeLocal} IS NULL)
      OR (${table.kind} = 'time_of_day' AND ${table.dayOffset} IS NOT NULL
        AND ${table.timeLocal} IS NOT NULL AND ${table.offsetMinutes} IS NULL)
      OR (${table.kind} = 'absolute' AND ${table.offsetMinutes} IS NULL
        AND ${table.dayOffset} IS NULL AND ${table.timeLocal} IS NULL)
    )`,
  );
}

/** Each user's default reminder set, auto-applied to their new assignments. */
export const defaultReminderRules = pgTable(
  "default_reminder_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId,
    kind: ruleKindEnum("kind").notNull(),
    /** Minutes before the due time. `kind = 'offset'`. */
    offsetMinutes: integer("offset_minutes"),
    /** Days relative to the due date: 0 = day of, -1 = day before. */
    dayOffset: integer("day_offset"),
    /** Local clock time, paired with `dayOffset`. */
    timeLocal: time("time_local"),
    label: text("label"),
    enabled: boolean("enabled").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("default_reminder_rules_user_idx").on(table.userId),
    // An absolute timestamp makes no sense as a reusable default.
    check("default_rule_kind_allowed", sql`${table.kind} IN ('offset', 'time_of_day')`),
    ruleKindShapeCheck("default_rule_shape", table),
  ],
);

export const assignments = pgTable(
  "assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId,
    title: text("title").notNull(),
    description: text("description"),
    className: text("class_name"),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    /** Soft delete, so the delivery log keeps referring to something real. */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("assignments_due_at_idx").on(table.dueAt),
    index("assignments_user_due_at_idx").on(table.userId, table.dueAt),
    check("assignments_title_not_blank", sql`length(trim(${table.title})) > 0`),
  ],
);

export const reminderRules = pgTable(
  "reminder_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => assignments.id, { onDelete: "cascade" }),
    kind: ruleKindEnum("kind").notNull(),
    offsetMinutes: integer("offset_minutes"),
    dayOffset: integer("day_offset"),
    timeLocal: time("time_local"),
    /** Fully custom one-off reminder time. `kind = 'absolute'`. */
    absoluteAt: timestamp("absolute_at", { withTimezone: true }),
    label: text("label"),
    origin: ruleOriginEnum("origin").notNull().default("manual"),
    enabled: boolean("enabled").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("reminder_rules_assignment_idx").on(table.assignmentId),
    ruleKindShapeCheck("reminder_rule_shape", table),
    check(
      "reminder_rule_absolute_at",
      sql`(${table.kind} = 'absolute') = (${table.absoluteAt} IS NOT NULL)`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Scheduled notifications
// ---------------------------------------------------------------------------

/**
 * One row per notification we intend to send, at a concrete instant.
 *
 * This table is the scheduler's source of truth. QStash only ever carries a
 * row id, and every delivery attempt re-reads and re-validates the row, so a
 * lost or un-cancellable QStash message can never produce a stray push.
 */
export const scheduledNotifications = pgTable(
  "scheduled_notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => assignments.id, { onDelete: "cascade" }),
    /** Copied from the assignment so QStash can fan out without a session. */
    userId,
    /** Null once the originating rule is deleted but the send already happened. */
    ruleId: uuid("rule_id").references(() => reminderRules.id, { onDelete: "set null" }),

    fireAt: timestamp("fire_at", { withTimezone: true }).notNull(),
    /** What the rule computed before quiet-hours substitution moved it. */
    originalFireAt: timestamp("original_fire_at", { withTimezone: true }),

    status: notificationStatusEnum("status").notNull().default("pending"),
    reason: notificationReasonEnum("reason"),

    qstashMessageId: text("qstash_message_id"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    /** Rendered title/body, snapshotted at send time. */
    payload: jsonb("payload"),

    createdAt,
    updatedAt,
  },
  (table) => [
    // Drives the materialiser and sweeper queries.
    index("scheduled_notifications_status_fire_at_idx").on(table.status, table.fireAt),
    index("scheduled_notifications_assignment_idx").on(table.assignmentId),
    index("scheduled_notifications_user_idx").on(table.userId),
    // Backstop for the engine's dedupe pass: two live reminders for one
    // assignment can never share an instant.
    uniqueIndex("scheduled_notifications_live_slot_idx")
      .on(table.assignmentId, table.fireAt)
      .where(sql`status NOT IN ('canceled', 'skipped')`),
  ],
);

// ---------------------------------------------------------------------------
// Push delivery
// ---------------------------------------------------------------------------

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId,
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    /** Consecutive send failures; reset on success. */
    failureCount: integer("failure_count").notNull().default(0),
    /** Set when the push service reports the subscription is gone (404/410). */
    disabledAt: timestamp("disabled_at", { withTimezone: true }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("push_subscriptions_disabled_idx").on(table.disabledAt),
    index("push_subscriptions_user_idx").on(table.userId),
  ],
);

/** Fan-out log: one notification goes to every active subscription. */
export const notificationDeliveries = pgTable(
  "notification_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scheduledNotificationId: uuid("scheduled_notification_id")
      .notNull()
      .references(() => scheduledNotifications.id, { onDelete: "cascade" }),
    subscriptionId: uuid("subscription_id").references(() => pushSubscriptions.id, {
      onDelete: "set null",
    }),
    status: deliveryStatusEnum("status").notNull(),
    httpStatus: integer("http_status"),
    error: text("error"),
    createdAt,
  },
  (table) => [
    index("notification_deliveries_notification_idx").on(table.scheduledNotificationId),
    index("notification_deliveries_created_idx").on(table.createdAt),
  ],
);

export type Settings = typeof settings.$inferSelect;
export type DefaultReminderRule = typeof defaultReminderRules.$inferSelect;
export type Assignment = typeof assignments.$inferSelect;
export type ReminderRule = typeof reminderRules.$inferSelect;
export type ScheduledNotification = typeof scheduledNotifications.$inferSelect;
export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect;
export type NotificationDelivery = typeof notificationDeliveries.$inferSelect;
