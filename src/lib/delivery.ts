import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, assignments, scheduledNotifications, type ScheduledNotification } from "@/lib/db";
import { sendPushToUser, type PushPayload } from "@/lib/push";
import { formatWhen } from "@/lib/format";
import { getSettings } from "@/lib/settings";

export type DeliveryOutcome = {
  status: "sent" | "canceled" | "failed" | "noop";
  detail: string;
};

/**
 * Atomically claims a notification and (if still valid) fans it out over web
 * push. Shared by the QStash webhook and the session-authenticated "send now"
 * button so both paths have the same idempotency guarantees.
 *
 * QStash has no Neon session: the scheduled row's `user_id` selects which
 * subscriptions receive the push. When `onlyUserId` is set (send now), the
 * claim itself refuses another user's row.
 */
export async function deliverNotification(
  notificationId: string,
  options: { onlyUserId?: string } = {},
): Promise<DeliveryOutcome> {
  const claimed = await claim(notificationId, options.onlyUserId);
  if (!claimed) {
    return { status: "noop", detail: "Already handled or not found" };
  }

  const [assignment] = await db
    .select()
    .from(assignments)
    .where(eq(assignments.id, claimed.assignmentId))
    .limit(1);

  if (!assignment || assignment.completedAt || assignment.deletedAt) {
    await finish(claimed.id, "canceled", "Assignment is complete or deleted");
    return { status: "canceled", detail: "Assignment is complete or deleted" };
  }

  const userId = claimed.userId ?? assignment.userId;
  if (!userId) {
    await finish(claimed.id, "failed", "Notification has no owner");
    return { status: "failed", detail: "Notification has no owner" };
  }

  const settings = await getSettings(userId);
  const payload = renderPayload(assignment.title, assignment.dueAt, claimed, settings.timezone);

  try {
    const result = await sendPushToUser(userId, payload, { notificationId: claimed.id });

    if (result.succeeded === 0) {
      const detail = result.errors.join("; ") || "No successful deliveries";
      await finish(claimed.id, "failed", detail, payload);
      return { status: "failed", detail };
    }

    await finish(claimed.id, "sent", null, payload);
    return { status: "sent", detail: `Delivered to ${result.succeeded} device(s)` };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Push failed";
    await finish(claimed.id, "failed", detail, payload);
    return { status: "failed", detail };
  }
}

async function claim(id: string, onlyUserId?: string): Promise<ScheduledNotification | undefined> {
  const [row] = await db
    .update(scheduledNotifications)
    .set({
      status: "sending",
      attempts: sql`${scheduledNotifications.attempts} + 1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(scheduledNotifications.id, id),
        inArray(scheduledNotifications.status, ["pending", "enqueued", "failed"]),
        ...(onlyUserId ? [eq(scheduledNotifications.userId, onlyUserId)] : []),
      ),
    )
    .returning();

  return row;
}

async function finish(
  id: string,
  status: "sent" | "failed" | "canceled",
  lastError: string | null,
  payload?: PushPayload,
) {
  await db
    .update(scheduledNotifications)
    .set({
      status,
      lastError,
      sentAt: status === "sent" ? new Date() : null,
      payload: payload ?? undefined,
      updatedAt: new Date(),
    })
    .where(eq(scheduledNotifications.id, id));
}

export function renderPayload(
  title: string,
  dueAt: Date,
  notification: Pick<ScheduledNotification, "id" | "reason" | "assignmentId">,
  timezone: string,
): PushPayload {
  const when = formatWhen(dueAt, timezone);
  const overdue = notification.reason === "overdue_nudge";

  return {
    title: overdue ? `Overdue: ${title}` : title,
    body: overdue ? `Was due ${when}` : `Due ${when}`,
    url: `/assignments/${notification.assignmentId}`,
    tag: `assignment-${notification.assignmentId}`,
  };
}
