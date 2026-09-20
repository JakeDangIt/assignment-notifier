import { fail, isAuthError, ok, requireSession, route } from "@/lib/api";
import { deliverNotification } from "@/lib/delivery";
import { verifyQstashSignature } from "@/lib/qstash";

export const runtime = "nodejs";

export const POST = route(
  async (request: Request) => {
    const bodyText = await request.text();
    const signed = await verifyQstashSignature(request, bodyText);

    let onlyUserId: string | undefined;
    if (!signed) {
      // Manual fallback (Send now uses a dedicated route). QStash itself is
      // signature-only and never has a Neon session.
      const session = await requireSession();
      if (isAuthError(session)) return session;
      onlyUserId = session.id;
    }

    let notificationId: string | undefined;
    try {
      notificationId = JSON.parse(bodyText).notificationId;
    } catch {
      return fail(400, "Invalid JSON body");
    }

    if (!notificationId) return fail(400, "notificationId is required");

    const outcome = await deliverNotification(notificationId, { onlyUserId });

    if (outcome.status === "failed") {
      // 500 asks QStash to retry with backoff; the tick sweeper is the backstop.
      return fail(500, outcome.detail);
    }

    return ok(outcome);
  },
  { public: true },
);
