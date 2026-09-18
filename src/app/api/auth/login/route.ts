import { cookies } from "next/headers";
import { z } from "zod";
import { constantTimeEquals, createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/lib/auth";
import { fail, ok, route } from "@/lib/api";
import { env } from "@/lib/env";
import { checkRateLimit, describeRetryAfter } from "@/lib/rate-limit";

const bodySchema = z.object({
  passcode: z.string().min(1).max(200),
});

export const POST = route(
  async (request: Request) => {
    // Keyed on the forwarded client IP so a single source can't grind through
    // the passcode space. Single-user app, so the budget can be tight.
    const clientKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    const limit = checkRateLimit(`login:${clientKey}`, { limit: 8, windowMs: 10 * 60_000 });

    if (!limit.allowed) {
      return fail(429, `Too many attempts. Try again in ${describeRetryAfter(limit.retryAfterMs)}.`);
    }

    const { passcode } = bodySchema.parse(await request.json());

    if (!(await constantTimeEquals(passcode, env.appPasscode))) {
      return fail(401, "Incorrect passcode");
    }

    const store = await cookies();
    store.set(SESSION_COOKIE, await createSessionToken(env.sessionSecret), {
      httpOnly: true,
      sameSite: "lax",
      secure: env.isProduction,
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });

    return ok({ ok: true });
  },
  { public: true },
);
