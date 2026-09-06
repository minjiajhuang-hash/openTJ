import { z } from "zod";
import { requireCourseAccess } from "@/lib/server/auth";
import { submitAppeal } from "@/lib/server/moderation";
import { apiData, parseJson, requireSameOrigin, withApi } from "@/lib/server/http";
type Context = { params: Promise<{ slug: string }> };
export const POST = withApi<Context>(async (request, context, ctx) => { requireSameOrigin(request); const input=await parseJson(request,z.object({contentId:z.string().min(1),message:z.string().trim().min(3).max(5000)})); return apiData(await submitAppeal(await requireCourseAccess(request,(await context.params).slug),input.contentId,input.message),ctx.requestId); });
