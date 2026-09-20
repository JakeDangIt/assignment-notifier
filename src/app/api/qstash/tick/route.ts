import { ok, requireSession, route } from "@/lib/api";
import { verifyQstashSignature } from "@/lib/qstash";
import { runTick } from "@/lib/tick";

export const runtime = "nodejs";

export const POST = route(
  async (request: Request) => {
    const bodyText = await request.text();
    const signed = await verifyQstashSignature(request, bodyText);

    if (!signed) {
      // Owner UI (Run tick) authenticates with a Neon session. QStash itself
      // never has a session — it must present a valid upstash-signature.
      const unauthorized = await requireSession();
      if (unauthorized) return unauthorized;
    }

    const result = await runTick();
    return ok(result);
  },
  { public: true },
);
