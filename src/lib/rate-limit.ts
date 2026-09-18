import "server-only";

/**
 * Fixed-window rate limiter held in process memory.
 *
 * Serverless instances don't share memory, so this is best-effort: a
 * distributed attacker hitting many cold instances gets more attempts than the
 * nominal budget. That's an accepted tradeoff for a single-user app -- it stops
 * casual brute-forcing of the passcode without adding a Redis dependency.
 */

type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();

/** Bounds memory if a spoofed X-Forwarded-For is used to create many keys. */
const MAX_TRACKED_KEYS = 5_000;

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
};

export function checkRateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): RateLimitResult {
  const now = Date.now();
  const existing = windows.get(key);

  if (!existing || existing.resetAt <= now) {
    if (windows.size >= MAX_TRACKED_KEYS) {
      for (const [candidate, window] of windows) {
        if (window.resetAt <= now) windows.delete(candidate);
      }
      if (windows.size >= MAX_TRACKED_KEYS) windows.clear();
    }

    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterMs: 0 };
  }

  existing.count += 1;

  if (existing.count > limit) {
    return { allowed: false, remaining: 0, retryAfterMs: existing.resetAt - now };
  }

  return { allowed: true, remaining: limit - existing.count, retryAfterMs: 0 };
}

export function describeRetryAfter(retryAfterMs: number): string {
  const minutes = Math.ceil(retryAfterMs / 60_000);
  if (minutes <= 1) return "a minute";
  return `${minutes} minutes`;
}
