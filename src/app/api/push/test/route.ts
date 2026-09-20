import { fail, ok, route } from "@/lib/api";
import { sendPushToUser } from "@/lib/push";
import { requireAppUser } from "@/lib/session";

export const runtime = "nodejs";

/**
 * Sends a real push through the exact delivery path reminders use, so a green
 * result here means timed reminders will also arrive.
 */
export const POST = route(async () => {
  const user = await requireAppUser();
  const result = await sendPushToUser(user.id, {
    title: "Test notification",
    body: "Push is working. Reminders will arrive like this.",
    url: "/",
    tag: "test-notification",
  });

  if (result.succeeded === 0) {
    return fail(502, "Push delivery failed", result);
  }

  return ok(result);
});
