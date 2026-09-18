import { eq } from "drizzle-orm";
import { z } from "zod";
import { ok, route } from "@/lib/api";
import { db, pushSubscriptions } from "@/lib/db";

const bodySchema = z.object({
  endpoint: z.string().url(),
});

export const POST = route(async (request: Request) => {
  const { endpoint } = bodySchema.parse(await request.json());

  // Hard delete: an intentional opt-out shouldn't linger in the log as a
  // disabled row that looks like a delivery failure.
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));

  return ok({ ok: true });
});
