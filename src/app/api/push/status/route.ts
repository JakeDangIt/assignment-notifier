import { desc, eq } from "drizzle-orm";
import { ok, route } from "@/lib/api";
import { db, pushSubscriptions } from "@/lib/db";
import { requireAppUser } from "@/lib/session";

/** Lets the client tell "this browser is registered" from "some device is". */
export const GET = route(async () => {
  const user = await requireAppUser();
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
    .where(eq(pushSubscriptions.userId, user.id))
    .orderBy(desc(pushSubscriptions.createdAt));

  return ok({ subscriptions: rows });
});
