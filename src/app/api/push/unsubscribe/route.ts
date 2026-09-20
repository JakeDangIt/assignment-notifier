import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { ok, route } from "@/lib/api";
import { db, pushSubscriptions } from "@/lib/db";
import { requireAppUser } from "@/lib/session";

const bodySchema = z.object({
  endpoint: z.string().url(),
});

export const POST = route(async (request: Request) => {
  const user = await requireAppUser();
  const { endpoint } = bodySchema.parse(await request.json());

  // Hard delete: an intentional opt-out shouldn't linger in the log as a
  // disabled row that looks like a delivery failure.
  await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, user.id)));

  return ok({ ok: true });
});
