import { fail, ok, route } from "@/lib/api";
import { sendPushToAll } from "@/lib/push";

/**
 * Sends a real push through the exact delivery path reminders use, so a green
 * result here means timed reminders will also arrive.
 */
export const POST = route(async () => {
  const result = await sendPushToAll({
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
