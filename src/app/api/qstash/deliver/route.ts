import { fail, ok, requireSession, route } from "@/lib/api";
import { deliverNotification } from "@/lib/delivery";
import { verifyQstashSignature } from "@/lib/qstash";

export const POST = route(
  async (request: Request) => {
    const bodyText = await request.text();
    const signed = await verifyQstashSignature(request, bodyText);

    if (!signed) {
      const unauthorized = await requireSession();
      if (unauthorized) return fail(401, "Unauthorized");
    }

    let notificationId: string | undefined;
    try {
      notificationId = JSON.parse(bodyText).notificationId;
    } catch {
      return fail(400, "Invalid JSON body");
    }

    if (!notificationId) return fail(400, "notificationId is required");

    const outcome = await deliverNotification(notificationId);

    if (outcome.status === "failed") {
      // 500 asks QStash to retry with backoff; the tick sweeper is the backstop.
      return fail(500, outcome.detail);
    }

    return ok(outcome);
  },
  { public: true },
);
