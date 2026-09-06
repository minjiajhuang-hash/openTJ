import { z } from "zod";
import { createSession, destroySession, getDemoPersona } from "@/lib/server/auth";
import { isDemoAuthEnabled, SESSION_COOKIE, sessionCookieOptions } from "@/lib/server/env";
import { AppError, apiData, parseJson, withApi } from "@/lib/server/http";

const personas = {
  "student-member": "student", "student-nonmember": "nonmember", "course-staff": "teacher",
  "unassigned-teacher": "unassignedTeacher", "platform-admin": "admin", "suspended-user": "suspended",
} as const;
const schema = z.object({ persona: z.enum(Object.keys(personas) as [keyof typeof personas, ...(keyof typeof personas)[]]) });
export const POST = withApi(async (request, _context, { requestId }) => {
  if (!isDemoAuthEnabled()) throw new AppError(404, "NOT_FOUND", "Development authentication is disabled.");
  const { persona } = await parseJson(request, schema);
  const user = await getDemoPersona(personas[persona]);
  await destroySession(request);
  const session = await createSession(user.id, request);
  const response = apiData({ ...user, development: true }, requestId);
  response.cookies.set(SESSION_COOKIE, session.token, sessionCookieOptions());
  response.cookies.delete("opentj_demo_persona");
  return response;
});
