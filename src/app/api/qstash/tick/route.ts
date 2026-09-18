import { fail, ok, requireSession, route } from "@/lib/api";
import { verifyQstashSignature } from "@/lib/qstash";
import { runTick } from "@/lib/tick";

export const POST = route(
  async (request: Request) => {
    const bodyText = await request.text();
    const signed = await verifyQstashSignature(request, bodyText);

    if (!signed) {
      const unauthorized = await requireSession();
      if (unauthorized) return fail(401, "Unauthorized");
    }

    const result = await runTick();
    return ok(result);
  },
  { public: true },
);
