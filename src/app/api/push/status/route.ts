import { desc } from "drizzle-orm";
import { ok, route } from "@/lib/api";
import { db, pushSubscriptions } from "@/lib/db";

/** Lets the client tell "this browser is registered" from "some device is". */
export const GET = route(async () => {
  const rows = await db
    .select({
      id: pushSubscriptions.id,
      endpoint: pushSubscriptions.endpoint,
      userAgent: pushSubscriptions.userAgent,
      disabledAt: pushSubscriptions.disabledAt,
      failureCount: pushSubscriptions.failureCount,
      lastSuccessAt: pushSubscriptions.lastSuccessAt,
      createdAt: pushSubscriptions.createdAt,
    })
    .from(pushSubscriptions)
    .orderBy(desc(pushSubscriptions.createdAt));

  return ok({ subscriptions: rows });
});
