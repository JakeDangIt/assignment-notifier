import { isAuthError, ok, requireSession, route } from "@/lib/api";
import { verifyQstashSignature } from "@/lib/qstash";
import { runTick } from "@/lib/tick";

export const runtime = "nodejs";

export const POST = route(
  async (request: Request) => {
    const bodyText = await request.text();
    const signed = await verifyQstashSignature(request, bodyText);

    if (!signed) {
      // Run tick from the Log page authenticates with a Neon session. QStash
      // itself never has a session — it must present a valid upstash-signature.
      const session = await requireSession();
      if (isAuthError(session)) return session;
    }

    const result = await runTick();
    return ok(result);
  },
  { public: true },
);
