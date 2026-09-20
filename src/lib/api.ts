import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { env } from "@/lib/env";
import { HttpError, requireAppUser, type AppUser } from "@/lib/session";

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
 * Any signed-in Neon account is enough. Tenant isolation happens in queries
 * via `user.id`, not an email allowlist.
 *
 * Returns a 401 response to return early, or the signed-in user.
 */
export async function requireSession() {
  try {
    return await requireAppUser();
  } catch (error) {
    if (error instanceof HttpError) return fail(error.status, error.message);
    throw error;
  }
}

export function isAuthError(result: AppUser | NextResponse): result is NextResponse {
  return result instanceof NextResponse;
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
        const session = await requireSession();
        if (isAuthError(session)) return session;
      }

      return await handler(...args);
    } catch (error) {
      if (error instanceof ZodError) {
        return fail(400, "Invalid request", error.issues);
      }
      if (error instanceof HttpError) {
        return fail(error.status, error.message);
      }

      console.error("Unhandled route error", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return fail(500, env.isProduction ? "Internal server error" : message);
    }
  };
}
