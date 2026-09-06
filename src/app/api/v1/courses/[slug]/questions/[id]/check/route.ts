import { requireCourseAccess } from "@/lib/server/auth";
import { answerSchema, checkAnswer } from "@/lib/server/practice";
import { apiData, parseJson, requireSameOrigin, withApi } from "@/lib/server/http";
type Context = { params: Promise<{ slug: string; id: string }> };
export const POST = withApi<Context>(async (request, context, ctx) => { requireSameOrigin(request); const {slug,id} = await context.params; return apiData(await checkAnswer(await requireCourseAccess(request,slug),id,await parseJson(request,answerSchema)),ctx.requestId); });
