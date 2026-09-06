import { requirePlatformAdmin } from "@/lib/server/auth";
import { administer, adminSchema, adminSnapshot } from "@/lib/server/courses";
import { apiData, parseJson, requireSameOrigin, withApi } from "@/lib/server/http";
export const GET = withApi(async (request, _, ctx) => apiData(await adminSnapshot(request),ctx.requestId));
export const POST = withApi(async (request, _, ctx) => { requireSameOrigin(request); const actor=await requirePlatformAdmin(request); return apiData(await administer(actor.id,await parseJson(request,adminSchema),ctx.requestId),ctx.requestId); });
