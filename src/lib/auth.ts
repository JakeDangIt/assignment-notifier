import { SignJWT, jwtVerify } from "jose";

/**
 * Minimal single-user auth: one shared passcode exchanged for a long-lived
 * signed session cookie. There are no user records because there is exactly
 * one user; anything more would be scaffolding with no payload.
 *
 * Everything here is Edge-runtime safe (jose + Web Crypto only) so the same
 * helpers work in middleware and in route handlers.
 */

export const SESSION_COOKIE = "ar_session";

/** 90 days: long enough that an installed PWA effectively stays logged in. */
export const SESSION_MAX_AGE_SECONDS = 90 * 24 * 60 * 60;

const ISSUER = "assignment-reminders";
const SUBJECT = "owner";

function secretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(secret: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(SUBJECT)
    .setIssuer(ISSUER)
    .setIssuedAt(now)
    .setExpirationTime(now + SESSION_MAX_AGE_SECONDS)
    .sign(secretKey(secret));
}

export async function verifySessionToken(
  token: string | undefined,
  secret: string,
): Promise<boolean> {
  if (!token) return false;

  try {
    const { payload } = await jwtVerify(token, secretKey(secret), {
      issuer: ISSUER,
      subject: SUBJECT,
    });
    return Boolean(payload.sub);
  } catch {
    return false;
  }
}

/**
 * Compares two strings in time independent of where they first differ, so the
 * passcode endpoint doesn't leak a prefix oracle.
 *
 * Length is compared by hashing to a fixed-size digest first, because a naive
 * loop over differing lengths is itself a timing signal.
 */
export async function constantTimeEquals(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [digestA, digestB] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ]);

  const viewA = new Uint8Array(digestA);
  const viewB = new Uint8Array(digestB);

  let diff = 0;
  for (let i = 0; i < viewA.length; i++) {
    diff |= viewA[i] ^ viewB[i];
  }
  return diff === 0;
}
