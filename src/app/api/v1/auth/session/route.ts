import { getCurrentUser, isPlatformAdmin } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { isDemoAuthEnabled, POLICY_VERSION } from "@/lib/server/env";
import { apiData, withApi } from "@/lib/server/http";
export const GET = withApi(async (request, _context, { requestId }) => {
  const user = await getCurrentUser(request);
  if (!user) return apiData(null, requestId, { status: 401 });
  const [isAdmin, staff, policy] = await Promise.all([
    isPlatformAdmin(user.id),
    db.courseMembership.findFirst({ where: { userId: user.id, role: "STAFF", course: { archivedAt: null } }, select: { id: true } }),
    db.policyAcceptance.findUnique({ where: { userId_version: { userId: user.id, version: POLICY_VERSION } }, select: { id: true } }),
  ]);
  return apiData({ ...user, isAdmin, isCourseStaff: Boolean(staff) || isAdmin, policyAccepted: Boolean(policy), development: isDemoAuthEnabled() }, requestId);
});
