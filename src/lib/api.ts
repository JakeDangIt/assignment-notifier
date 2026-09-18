import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { env } from "@/lib/env";

/** Shared helpers so route handlers stay thin and respond consistently. */

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

/**
 * Re-checks the session inside the route handler rather than trusting
 * middleware alone. Middleware is the primary gate, but header-spoofing bypass
 * bugs against Next middleware have shipped before, and a second check on
 * mutating endpoints is nearly free.
 *
 * Returns a 401 response to return early, or null when the caller is authorised.
 */
export async function requireSession(): Promise<NextResponse | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  if (await verifySessionToken(token, env.sessionSecret)) return null;
  return fail(401, "Unauthorized");
}

/**
 * Wraps a route handler with session enforcement and uniform error mapping.
 *
 * `public: true` skips the session check for endpoints that authenticate some
 * other way (QStash signatures) or carry no secrets (the VAPID public key).
 */
export function route<Args extends unknown[]>(
  handler: (...args: Args) => Promise<NextResponse>,
  options: { public?: boolean } = {},
) {
  return async (...args: Args): Promise<NextResponse> => {
    try {
      if (!options.public) {
        const unauthorized = await requireSession();
        if (unauthorized) return unauthorized;
      }

      return await handler(...args);
    } catch (error) {
      if (error instanceof ZodError) {
        return fail(400, "Invalid request", error.issues);
      }

      console.error("Unhandled route error", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return fail(500, env.isProduction ? "Internal server error" : message);
    }
  };
}
