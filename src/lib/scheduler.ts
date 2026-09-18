import "server-only";
import { env } from "@/lib/env";

/**
 * QStash is only a doorbell. The database remains the source of truth: every
 * published message carries a notification id, and delivery re-reads the row.
 *
 * This module is safe to call when QStash isn't configured — enqueue becomes a
 * no-op and the 15-minute tick (once configured) is what eventually fires
 * anything left `pending`. Local development therefore works without Upstash.
 */

export type EnqueueResult = { messageId: string | null; enqueued: boolean };

export function isWithinHorizon(fireAt: Date, now = new Date()): boolean {
  const horizonMs = env.schedulingHorizonHours * 60 * 60 * 1000;
  return fireAt.getTime() <= now.getTime() + horizonMs;
}

export async function enqueueNotification(
  notificationId: string,
  fireAt: Date,
): Promise<EnqueueResult> {
  if (!env.schedulingEnabled) {
    return { messageId: null, enqueued: false };
  }

  const { publishAt } = await import("./qstash");
  return publishAt(notificationId, fireAt);
}

export async function cancelScheduledMessage(messageId: string | null | undefined): Promise<void> {
  if (!messageId || !env.schedulingEnabled) return;
  const { cancelMessage } = await import("./qstash");
  await cancelMessage(messageId);
}
