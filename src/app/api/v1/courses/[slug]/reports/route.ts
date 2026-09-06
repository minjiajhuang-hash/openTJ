import { requireCourseAccess } from "@/lib/server/auth";
import { reportSchema, submitReport } from "@/lib/server/moderation";
import { apiData, parseJson, requireSameOrigin, withApi } from "@/lib/server/http";
type Context = { params: Promise<{ slug: string }> };
export const POST = withApi<Context>(async (request, context, ctx) => { requireSameOrigin(request); return apiData(await submitReport(await requireCourseAccess(request,(await context.params).slug),await parseJson(request,reportSchema)),ctx.requestId); });
