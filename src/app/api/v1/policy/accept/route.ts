import { requireUser } from "@/lib/server/auth";
import { POLICY_VERSION } from "@/lib/server/env";
import { db } from "@/lib/server/db";
import { apiData, requireSameOrigin, withApi } from "@/lib/server/http";
export const POST = withApi(async (request, _, ctx) => { requireSameOrigin(request); const user=await requireUser(request); await db.policyAcceptance.upsert({where:{userId_version:{userId:user.id,version:POLICY_VERSION}},create:{userId:user.id,version:POLICY_VERSION},update:{}}); return apiData({accepted:true,version:POLICY_VERSION},ctx.requestId); });
