import { requireCourseAccess, linkAssessment } from "@/lib/server/content";
import { z } from "zod";
import { apiData, parseJson, requireSameOrigin, withApi } from "@/lib/server/http";
type Context = { params: Promise<{ slug: string; id: string }> };
export const POST = withApi<Context>(async (request, context, ctx) => { requireSameOrigin(request); const {slug,id} = await context.params; return apiData(await linkAssessment(await requireCourseAccess(request,slug),id,await parseJson(request,z.record(z.string(),z.unknown()))),ctx.requestId); });
