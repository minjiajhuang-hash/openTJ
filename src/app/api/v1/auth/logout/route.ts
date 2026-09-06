import { destroySession } from "@/lib/server/auth";
import { SESSION_COOKIE, OAUTH_COOKIE, sessionCookieOptions } from "@/lib/server/env";
import { apiData, withApi } from "@/lib/server/http";
export const POST = withApi(async (request, _context, { requestId }) => {
  await destroySession(request);
  const response = apiData({ loggedOut: true }, requestId);
  for (const name of [SESSION_COOKIE, OAUTH_COOKIE, "opentj_demo_persona"]) response.cookies.set(name, "", { ...sessionCookieOptions(), maxAge: 0 });
  return response;
});
