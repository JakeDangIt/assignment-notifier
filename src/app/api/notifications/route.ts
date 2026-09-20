import { desc, eq } from "drizzle-orm";
import { ok, route } from "@/lib/api";
import { assignments, db, notificationDeliveries, scheduledNotifications } from "@/lib/db";
import { requireAppUser } from "@/lib/session";

export const GET = route(async () => {
  const user = await requireAppUser();
  const rows = await db
    .select({
      id: scheduledNotifications.id,
      assignmentId: scheduledNotifications.assignmentId,
      assignmentTitle: assignments.title,
      fireAt: scheduledNotifications.fireAt,
      originalFireAt: scheduledNotifications.originalFireAt,
      status: scheduledNotifications.status,
      reason: scheduledNotifications.reason,
      attempts: scheduledNotifications.attempts,
      lastError: scheduledNotifications.lastError,
      sentAt: scheduledNotifications.sentAt,
    })
    .from(scheduledNotifications)
    .leftJoin(assignments, eq(assignments.id, scheduledNotifications.assignmentId))
    .where(eq(scheduledNotifications.userId, user.id))
    .orderBy(desc(scheduledNotifications.fireAt))
    .limit(200);

  const deliveries = await db
    .select({
      id: notificationDeliveries.id,
      scheduledNotificationId: notificationDeliveries.scheduledNotificationId,
      subscriptionId: notificationDeliveries.subscriptionId,
      status: notificationDeliveries.status,
      httpStatus: notificationDeliveries.httpStatus,
      error: notificationDeliveries.error,
      createdAt: notificationDeliveries.createdAt,
    })
    .from(notificationDeliveries)
    .innerJoin(
      scheduledNotifications,
      eq(scheduledNotifications.id, notificationDeliveries.scheduledNotificationId),
    )
    .where(eq(scheduledNotifications.userId, user.id))
    .orderBy(desc(notificationDeliveries.createdAt))
    .limit(200);

  return ok({
    notifications: rows.map((row) => ({
      ...row,
      fireAt: row.fireAt.toISOString(),
      originalFireAt: row.originalFireAt?.toISOString() ?? null,
      sentAt: row.sentAt?.toISOString() ?? null,
    })),
    deliveries: deliveries.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
    })),
  });
});
