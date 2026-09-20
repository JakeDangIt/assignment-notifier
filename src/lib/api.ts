import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { auth } from "@/lib/auth";
import { isOwnerEmail } from "@/lib/owner";
import { env } from "@/lib/env";

/** Shared helpers so route handlers stay thin and respond consistently. */

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

/**
 * Re-checks the Neon session inside the route handler rather than trusting
 * middleware alone. Middleware is the primary gate, but header-spoofing bypass
 * bugs against Next middleware have shipped before, and a second check on
 * mutating endpoints is nearly free.
 *
 * A valid Neon session is not enough: the signed-in email must match
 * OWNER_EMAIL. Wrong-account callers get 403 rather than 401 so the client
 * can tell "not signed in" from "signed in as someone else".
 *
 * Returns a 401/403 response to return early, or null when the caller is the owner.
 */
export async function requireSession(): Promise<NextResponse | null> {
  const { data: session } = await auth.getSession();
  if (!session?.user) return fail(401, "Unauthorized");
  if (!isOwnerEmail(session.user.email)) return fail(403, "Forbidden");
  return null;
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
