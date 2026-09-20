import { createNeonAuth } from "@neondatabase/auth/next/server";
import { isOwnerEmail } from "@/lib/owner";

/**
 * Neon Auth (Managed Better Auth) server instance.
 *
 * `createNeonAuth` requires a 32+ character cookie secret at init, so missing
 * env during `next build` gets a placeholder. Middleware and `requireSession`
 * still fail closed when the real values are absent at runtime.
 */
const FALLBACK_COOKIE_SECRET = "unconfigured-neon-auth-cookie-secret!";

export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL ?? "https://unconfigured.invalid/neondb/auth",
  cookies: {
    secret:
      process.env.NEON_AUTH_COOKIE_SECRET && process.env.NEON_AUTH_COOKIE_SECRET.length >= 32
        ? process.env.NEON_AUTH_COOKIE_SECRET
        : FALLBACK_COOKIE_SECRET,
  },
});

export { isOwnerEmail, normalizeEmail } from "@/lib/owner";

export type OwnerSession = {
  email: string;
};

/** Neon session whose email matches OWNER_EMAIL. */
export async function getOwnerSession(): Promise<OwnerSession | null> {
  const { data: session } = await auth.getSession();
  const email = session?.user?.email;
  if (!email || !isOwnerEmail(email)) return null;
  return { email };
}
