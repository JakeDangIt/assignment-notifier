import { fail, ok, route } from "@/lib/api";
import { deliverNotification } from "@/lib/delivery";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route(async (_request: Request, { params }: Ctx) => {
  const { id } = await params;
  const outcome = await deliverNotification(id);

  if (outcome.status === "failed") return fail(502, outcome.detail);
  return ok(outcome);
});
