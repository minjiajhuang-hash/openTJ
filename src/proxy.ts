import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/server/env";

export function proxy(request: NextRequest) {
  // This is an early navigation shortcut. The layout and every API recheck the
  // opaque session against the database; cookie presence never grants access.
  const protectedPage = /^\/(courses|me|moderation|admin)(\/|$)/.test(request.nextUrl.pathname);
  if (protectedPage && !request.cookies.get(SESSION_COOKIE)?.value) {
    const login = new URL("/login", request.url);
    login.searchParams.set("returnTo", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(login);
  }
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const development = process.env.NODE_ENV !== "production";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    // FullCalendar and KaTeX calculate inline layout styles. Scripts still need
    // the per-response nonce, including the small initial theme script.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:", "font-src 'self'",
    "connect-src 'self'", "frame-src 'self'", "object-src 'none'",
    "base-uri 'self'", "form-action 'self' https://ion.tjhsst.edu",
    "frame-ancestors 'none'",
  ].join("; ");
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

// Framework upgrade requests (notably /_next/hmr) must bypass the page proxy.
export const config = { matcher: ["/((?!api|_next/|favicon.svg|fonts/).*)"] };
