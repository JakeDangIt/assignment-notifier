import { AppShell } from "@/components/AppShell";
import { DeliveryLog } from "@/components/DeliveryLog";
import { db, scheduledNotifications, assignments } from "@/lib/db";
import { desc, eq } from "drizzle-orm";
import { requirePageUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Delivery log" };

export default async function LogPage() {
  const user = await requirePageUser();
  const settings = await getSettings(user.id);
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

  return (
    <AppShell title="Delivery log" subtitle="Sent, pending, and failed reminders.">
      <DeliveryLog
        timezone={settings.timezone}
        initial={rows.map((row) => ({
          ...row,
          fireAt: row.fireAt.toISOString(),
          originalFireAt: row.originalFireAt?.toISOString() ?? null,
          sentAt: row.sentAt?.toISOString() ?? null,
        }))}
      />
    </AppShell>
  );
}
