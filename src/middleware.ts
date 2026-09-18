import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

/**
 * Gates the whole app behind the session cookie, with a small set of
 * deliberately public paths.
 *
 * QStash webhooks are exempt because they arrive without a browser session;
 * they authenticate themselves by request signature instead (see
 * src/lib/qstash.ts).
 */
const PUBLIC_PATHS = [
  "/login",
  "/offline",
  "/api/auth/login",
  // Signature-verified rather than session-verified.
  "/api/qstash/deliver",
  "/api/qstash/tick",
  // A public key by definition; the service worker fetches it to re-subscribe.
  "/api/push/vapid-public-key",
  "/manifest.webmanifest",
  "/sw.js",
];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  return pathname.startsWith("/icons/");
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    // Fail closed: an unconfigured deployment must not serve data.
    return NextResponse.json(
      { error: "Server is missing SESSION_SECRET" },
      { status: 500 },
    );
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (await verifySessionToken(token, secret)) {
    return NextResponse.next();
  }

  // API callers get a status they can act on; page requests get the login form.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  if (pathname !== "/") {
    loginUrl.searchParams.set("next", `${pathname}${search}`);
  }
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Everything except Next's build output and static files with extensions.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
