import { desc, eq } from "drizzle-orm";
import { ok, route } from "@/lib/api";
import { assignments, db, notificationDeliveries, scheduledNotifications } from "@/lib/db";

export const GET = route(async () => {
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
    .orderBy(desc(scheduledNotifications.fireAt))
    .limit(200);

  const deliveries = await db
    .select()
    .from(notificationDeliveries)
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
