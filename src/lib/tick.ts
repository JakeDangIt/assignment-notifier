import "server-only";
import { and, eq, inArray, isNotNull, lte, sql } from "drizzle-orm";
import { db, pushSubscriptions, scheduledNotifications } from "@/lib/db";
import { deliverNotification } from "@/lib/delivery";
import { enqueueNotification, isWithinHorizon } from "@/lib/scheduler";

const MAX_ATTEMPTS = 8;
const STALE_SUBSCRIPTION_DAYS = 30;

export async function runTick(now = new Date()) {
  const materialized = await materializeHorizon(now);
  const swept = await sweepDue(now);
  const pruned = await pruneSubscriptions(now);

  return { materialized, swept, pruned };
}

/** Hand pending rows that have entered the scheduling horizon to QStash. */
async function materializeHorizon(now: Date) {
  const pending = await db
    .select()
    .from(scheduledNotifications)
    .where(eq(scheduledNotifications.status, "pending"));

  let enqueued = 0;

  for (const row of pending) {
    if (!isWithinHorizon(row.fireAt, now)) continue;

    try {
      const result = await enqueueNotification(row.id, row.fireAt);
      if (!result.enqueued) continue;

      const updated = await db
        .update(scheduledNotifications)
        .set({
          status: "enqueued",
          qstashMessageId: result.messageId,
          updatedAt: new Date(),
        })
        .where(
          and(eq(scheduledNotifications.id, row.id), eq(scheduledNotifications.status, "pending")),
        )
        .returning({ id: scheduledNotifications.id });

      if (updated.length > 0) enqueued += 1;
    } catch (error) {
      console.error(`Tick failed to enqueue ${row.id}`, error);
    }
  }

  return enqueued;
}

/** Deliver anything whose fire time has arrived but is still unsent. */
async function sweepDue(now: Date) {
  const due = await db
    .select()
    .from(scheduledNotifications)
    .where(
      and(
        lte(scheduledNotifications.fireAt, now),
        inArray(scheduledNotifications.status, ["pending", "enqueued", "failed"]),
        sql`${scheduledNotifications.attempts} < ${MAX_ATTEMPTS}`,
      ),
    );

  let sent = 0;
  let failed = 0;

  for (const row of due) {
    const outcome = await deliverNotification(row.id);
    if (outcome.status === "sent") sent += 1;
    if (outcome.status === "failed") failed += 1;
  }

  return { due: due.length, sent, failed };
}

async function pruneSubscriptions(now: Date) {
  const cutoff = new Date(now.getTime() - STALE_SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000);

  const removed = await db
    .delete(pushSubscriptions)
    .where(and(isNotNull(pushSubscriptions.disabledAt), lte(pushSubscriptions.disabledAt, cutoff)))
    .returning({ id: pushSubscriptions.id });

  return removed.length;
}
