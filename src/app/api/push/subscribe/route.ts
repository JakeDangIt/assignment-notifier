import { eq } from "drizzle-orm";
import { z } from "zod";
import { ok, route } from "@/lib/api";
import { db, pushSubscriptions } from "@/lib/db";

const bodySchema = z.object({
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({
      p256dh: z.string().min(1),
      auth: z.string().min(1),
    }),
  }),
  /** Set by `pushsubscriptionchange` so the rotated-out endpoint can be dropped. */
  oldEndpoint: z.string().url().nullish(),
});

export const POST = route(async (request: Request) => {
  const { subscription, oldEndpoint } = bodySchema.parse(await request.json());
  const userAgent = request.headers.get("user-agent");
  const now = new Date();

  // Endpoints are stable identifiers, so re-subscribing on an existing device
  // updates the row (and clears any earlier `disabled_at`) instead of
  // accumulating duplicates that would double-notify.
  const [row] = await db
    .insert(pushSubscriptions)
    .values({
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent,
      lastSeenAt: now,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent,
        lastSeenAt: now,
        updatedAt: now,
        disabledAt: null,
        failureCount: 0,
      },
    })
    .returning({ id: pushSubscriptions.id });

  if (oldEndpoint && oldEndpoint !== subscription.endpoint) {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, oldEndpoint));
  }

  return ok({ id: row.id });
});
