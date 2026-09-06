import { moderationSnapshot } from "@/lib/server/moderation";
import { apiData, withApi } from "@/lib/server/http";
export const GET = withApi(async (request, _, ctx) => apiData(await moderationSnapshot(request),ctx.requestId));
