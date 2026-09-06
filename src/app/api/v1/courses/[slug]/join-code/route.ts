import { rotateJoinCode, requireCourseAccess } from "@/lib/server/courses";
import { apiData, requireSameOrigin, withApi } from "@/lib/server/http";
type Context = { params: Promise<{ slug: string }> };
export const POST = withApi<Context>(async (request, context, ctx) => { requireSameOrigin(request); return apiData(await rotateJoinCode(await requireCourseAccess(request,(await context.params).slug,{moderate:true}),ctx.requestId),ctx.requestId); });
