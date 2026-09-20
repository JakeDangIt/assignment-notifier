import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";

/**
 * Gates the app behind a Neon Auth session. Any signed-in account can use
 * the app; each user only sees their own assignments and notifications.
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

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isExtraPublic(pathname)) return NextResponse.next();

  if (!process.env.NEON_AUTH_BASE_URL || !process.env.NEON_AUTH_COOKIE_SECRET) {
    return NextResponse.json(
      { error: "Server is missing Neon Auth configuration" },
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

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
