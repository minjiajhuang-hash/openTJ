import { requireCourseAccess } from "@/lib/server/auth";
import { moderationSchema, moderate } from "@/lib/server/moderation";
import { apiData, parseJson, requireSameOrigin, withApi } from "@/lib/server/http";
type Context = { params: Promise<{ slug: string }> };
export const POST = withApi<Context>(async (request, context, ctx) => { requireSameOrigin(request); return apiData(await moderate(await requireCourseAccess(request,(await context.params).slug,{moderate:true}),await parseJson(request,moderationSchema),ctx.requestId),ctx.requestId); });
