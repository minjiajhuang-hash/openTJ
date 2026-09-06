import { NextResponse } from "next/server";
import { beginIonAuthorization } from "@/lib/server/oauth";
import { getAppUrl, OAUTH_COOKIE, sessionCookieOptions } from "@/lib/server/env";
import { withApi } from "@/lib/server/http";

export const GET = withApi(async (request) => {
  if (!process.env.ION_CLIENT_ID || !process.env.ION_CLIENT_SECRET || !process.env.DATABASE_URL) {
    return NextResponse.redirect(new URL("/login?ion=not-configured", getAppUrl()));
  }
  try {
    const target = await beginIonAuthorization(request.nextUrl.searchParams.get("returnTo"));
    const response = NextResponse.redirect(target.url);
    response.cookies.set(OAUTH_COOKIE, target.binding, { ...sessionCookieOptions(), maxAge: 600 });
    response.headers.set("cache-control", "private, no-store");
    return response;
  } catch {
    return NextResponse.redirect(new URL("/login?ion=unavailable", getAppUrl()));
  }
});
