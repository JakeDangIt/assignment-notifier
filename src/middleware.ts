import {
  NEON_AUTH_SESSION_DATA_COOKIE_NAME,
  validateSessionData,
} from "@neondatabase/auth/server";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { isOwnerEmail } from "@/lib/owner";

/**
 * Gates the app behind a Neon Auth session, then behind OWNER_EMAIL.
 *
 * Neon middleware already skips /api/auth and the sign-in/sign-up pages.
 * The extra public paths below are either signature-authenticated (QStash),
 * a public key, or PWA/static assets that must load without a session.
 */
const EXTRA_PUBLIC_PATHS = [
  "/offline",
  "/api/qstash/deliver",
  "/api/qstash/tick",
  "/api/push/vapid-public-key",
  "/manifest.webmanifest",
  "/sw.js",
];

const NEON_PUBLIC_PREFIXES = [
  "/api/auth",
  "/auth/sign-in",
  "/auth/sign-up",
  "/auth/callback",
  "/auth/magic-link",
  "/auth/email-otp",
  "/auth/forgot-password",
];

const neonAuth = auth.middleware({ loginUrl: "/auth/sign-in" });

function isExtraPublic(pathname: string): boolean {
  if (EXTRA_PUBLIC_PATHS.includes(pathname)) return true;
  return pathname.startsWith("/icons/");
}

function isNeonPublic(pathname: string): boolean {
  return NEON_PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function cookieFromSetCookie(headers: string[], name: string): string | undefined {
  const prefix = `${name}=`;
  for (const header of headers) {
    if (header.startsWith(prefix)) {
      const raw = header.slice(prefix.length).split(";")[0];
      try {
        return decodeURIComponent(raw);
      } catch {
        return raw;
      }
    }
  }
  return undefined;
}

async function sessionEmailFrom(
  request: NextRequest,
  response: NextResponse,
): Promise<string | null> {
  const secret = process.env.NEON_AUTH_COOKIE_SECRET;
  if (!secret) return null;

  const candidates = [
    request.cookies.get(NEON_AUTH_SESSION_DATA_COOKIE_NAME)?.value,
    cookieFromSetCookie(response.headers.getSetCookie(), NEON_AUTH_SESSION_DATA_COOKIE_NAME),
  ];

  for (const value of candidates) {
    if (!value) continue;
    const result = await validateSessionData(value, secret);
    const email = result.payload?.user?.email;
    if (typeof email === "string" && email.length > 0) return email;
  }

  return null;
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isExtraPublic(pathname)) return NextResponse.next();

  if (!process.env.NEON_AUTH_BASE_URL || !process.env.NEON_AUTH_COOKIE_SECRET) {
    return NextResponse.json(
      { error: "Server is missing Neon Auth configuration" },
      { status: 500 },
    );
  }

  if (!process.env.OWNER_EMAIL) {
    return NextResponse.json(
      { error: "Server is missing OWNER_EMAIL" },
      { status: 500 },
    );
  }

  const response = await neonAuth(request);

  if (response.headers.has("location")) {
    // Neon redirects browsers to sign-in. API callers need a status they can act on.
    if (pathname.startsWith("/api/") && !isNeonPublic(pathname)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return response;
  }
  if (isNeonPublic(pathname)) return response;

  const email = await sessionEmailFrom(request, response);
  if (isOwnerEmail(email)) {
    if (pathname === "/not-the-owner") {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return response;
  }

  // Signed in (Neon allowed the request) but not the owner.
  if (pathname === "/not-the-owner") return response;

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.redirect(new URL("/not-the-owner", request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
