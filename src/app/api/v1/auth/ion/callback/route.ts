import { NextResponse } from "next/server";
import { createSession, destroySession } from "@/lib/server/auth";
import { getAppUrl, OAUTH_COOKIE, SESSION_COOKIE, sessionCookieOptions } from "@/lib/server/env";
import { finishIonAuthorization } from "@/lib/server/oauth";
import { withApi } from "@/lib/server/http";

export const GET = withApi(async (request) => {
  try {
    const { user, returnTo } = await finishIonAuthorization(request.nextUrl, request.cookies.get(OAUTH_COOKIE)?.value);
    await destroySession(request);
    const session = await createSession(user.id, request);
    const response = NextResponse.redirect(new URL(returnTo, getAppUrl()));
    response.cookies.set(SESSION_COOKIE, session.token, sessionCookieOptions());
    response.cookies.delete(OAUTH_COOKIE);
    response.headers.set("cache-control", "private, no-store");
    return response;
  } catch {
    const response = NextResponse.redirect(new URL("/login?ion=failed", getAppUrl()));
    response.cookies.delete(OAUTH_COOKIE);
    return response;
  }
});
