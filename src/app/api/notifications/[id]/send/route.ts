import { fail, ok, route } from "@/lib/api";
import { deliverNotification } from "@/lib/delivery";
import { requireAppUser } from "@/lib/session";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route(async (_request: Request, { params }: Ctx) => {
  const user = await requireAppUser();
  const { id } = await params;
  const outcome = await deliverNotification(id, { onlyUserId: user.id });

  if (outcome.status === "failed") return fail(502, outcome.detail);
  if (outcome.status === "noop") return fail(404, "Notification not found");
  return ok(outcome);
});
