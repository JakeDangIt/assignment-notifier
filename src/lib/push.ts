import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import webpush, { WebPushError } from "web-push";
import { db, notificationDeliveries, pushSubscriptions, type PushSubscriptionRow } from "@/lib/db";
import { env } from "@/lib/env";

/**
 * Web Push delivery via VAPID.
 *
 * Deliberately not a mobile push SDK: the same code path serves Android Chrome,
 * desktop browsers and installed iOS PWAs.
 */

export type PushPayload = {
  title: string;
  body: string;
  /** Path the notification opens; handled by notificationclick in sw.js. */
  url?: string;
  /** Collapse key, so re-reminders for one assignment replace each other. */
  tag?: string;
};

let vapidConfigured = false;

function configureVapid() {
  if (vapidConfigured) return;

  const subject = env.vapidSubject;
  // Apple's push service rejects a VAPID `sub` that isn't a mailto: or https: URL,
  // and the resulting error is opaque, so check it up front.
  if (!/^mailto:|^https:\/\//.test(subject)) {
    throw new Error(
      `VAPID_SUBJECT must be a "mailto:" or "https://" URL, got "${subject}".`,
    );
  }

  webpush.setVapidDetails(subject, env.vapidPublicKey, env.vapidPrivateKey);
  vapidConfigured = true;
}

export type PushResult = {
  attempted: number;
  succeeded: number;
  /** Subscriptions the push service reported as gone; now disabled. */
  expired: number;
  failed: number;
  errors: string[];
};

/** Push services that report a subscription no longer exists. */
function isGoneStatus(status: number | undefined): boolean {
  return status === 404 || status === 410;
}

export async function listActiveSubscriptions(): Promise<PushSubscriptionRow[]> {
  return db
    .select()
    .from(pushSubscriptions)
    .where(isNull(pushSubscriptions.disabledAt));
}

/**
 * Fans a payload out to every active subscription.
 *
 * When `notificationId` is supplied, one row per subscription is written to the
 * delivery log; the test notification omits it because it has no scheduled
 * notification to reference.
 */
export async function sendPushToAll(
  payload: PushPayload,
  options: { notificationId?: string } = {},
): Promise<PushResult> {
  configureVapid();

  const subscriptions = await listActiveSubscriptions();
  const result: PushResult = {
    attempted: subscriptions.length,
    succeeded: 0,
    expired: 0,
    failed: 0,
    errors: [],
  };

  if (subscriptions.length === 0) {
    result.errors.push("No active push subscriptions");
    return result;
  }

  const body = JSON.stringify(payload);

  // Sent in parallel: one slow or dead endpoint must not delay the others,
  // which matters under a serverless function timeout.
  const outcomes = await Promise.allSettled(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          body,
          {
            // Let the push service hold the message briefly if the device is
            // offline, but not so long that a reminder arrives irrelevantly late.
            TTL: 60 * 60,
            urgency: "high",
          },
        );

        await markSubscriptionSuccess(subscription.id);
        await logDelivery(options.notificationId, subscription.id, {
          status: "sent",
          httpStatus: 201,
        });
        return { kind: "sent" as const };
      } catch (error) {
        const status = error instanceof WebPushError ? error.statusCode : undefined;
        const message = error instanceof Error ? error.message : String(error);

        if (isGoneStatus(status)) {
          await disableSubscription(subscription.id, message);
          await logDelivery(options.notificationId, subscription.id, {
            status: "expired",
            httpStatus: status,
            error: message,
          });
          return { kind: "expired" as const, message };
        }

        await markSubscriptionFailure(subscription.id);
        await logDelivery(options.notificationId, subscription.id, {
          status: "failed",
          httpStatus: status,
          error: message,
        });
        return { kind: "failed" as const, message };
      }
    }),
  );

  for (const outcome of outcomes) {
    if (outcome.status === "rejected") {
      result.failed += 1;
      result.errors.push(String(outcome.reason));
      continue;
    }

    switch (outcome.value.kind) {
      case "sent":
        result.succeeded += 1;
        break;
      case "expired":
        result.expired += 1;
        result.errors.push(outcome.value.message);
        break;
      case "failed":
        result.failed += 1;
        result.errors.push(outcome.value.message);
        break;
    }
  }

  return result;
}

async function logDelivery(
  notificationId: string | undefined,
  subscriptionId: string,
  entry: { status: "sent" | "failed" | "expired"; httpStatus?: number; error?: string },
) {
  if (!notificationId) return;

  await db.insert(notificationDeliveries).values({
    scheduledNotificationId: notificationId,
    subscriptionId,
    status: entry.status,
    httpStatus: entry.httpStatus ?? null,
    // Push service errors can be verbose HTML; keep the log readable.
    error: entry.error ? entry.error.slice(0, 500) : null,
  });
}

async function markSubscriptionSuccess(id: string) {
  await db
    .update(pushSubscriptions)
    .set({ failureCount: 0, lastSuccessAt: new Date(), updatedAt: new Date() })
    .where(eq(pushSubscriptions.id, id));
}

async function markSubscriptionFailure(id: string) {
  await db
    .update(pushSubscriptions)
    .set({
      failureCount: sql`${pushSubscriptions.failureCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(pushSubscriptions.id, id));
}

export async function disableSubscription(id: string, reason: string) {
  await db
    .update(pushSubscriptions)
    .set({ disabledAt: new Date(), updatedAt: new Date() })
    .where(and(eq(pushSubscriptions.id, id), isNull(pushSubscriptions.disabledAt)));

  console.warn(`Disabled push subscription ${id}: ${reason}`);
}
