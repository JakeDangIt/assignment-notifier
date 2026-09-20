/**
 * Helpers for per-user data. Tenant key is Neon Auth `user.id`, never email.
 *
 * Pre-tenancy rows (`user_id` IS NULL) stay unused unless claimed via
 * `MIGRATE_TO_USER_ID` during `npm run db:seed`.
 */

export function parseMigrateToUserId(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const value = env.MIGRATE_TO_USER_ID?.trim();
  return value ? value : null;
}

export function assertUserId(userId: string): string {
  const trimmed = userId.trim();
  if (!trimmed) {
    throw new Error("userId is required to load tenant data");
  }
  return trimmed;
}

type SessionLike = {
  user?: { id?: string | null; email?: string | null } | null;
  session?: { userId?: string | null } | null;
} | null;

/** Pulls Neon Auth `user.id` (falls back to `session.userId`). Never uses email. */
export function extractUserId(session: SessionLike | undefined): string | null {
  const raw = session?.user?.id || session?.session?.userId;
  if (typeof raw !== "string") return null;
  const id = raw.trim();
  return id.length > 0 ? id : null;
}

export function extractEmail(session: SessionLike | undefined): string | null {
  const raw = session?.user?.email;
  if (typeof raw !== "string") return null;
  const email = raw.trim();
  return email.length > 0 ? email : null;
}
