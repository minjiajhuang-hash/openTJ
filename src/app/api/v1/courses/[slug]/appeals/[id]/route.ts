import { z } from "zod";
import { requireCourseAccess } from "@/lib/server/auth";
import { resolveAppeal } from "@/lib/server/moderation";
import { apiData, parseJson, requireSameOrigin, withApi } from "@/lib/server/http";
type Context = { params: Promise<{ slug: string; id: string }> };
export const POST = withApi<Context>(async (request, context, ctx) => { requireSameOrigin(request); const {slug,id}=await context.params; const input=await parseJson(request,z.object({status:z.enum(["UPHELD","OVERTURNED"]),resolution:z.string().trim().min(3).max(5000)})); return apiData(await resolveAppeal(await requireCourseAccess(request,slug,{moderate:true}),id,input.status,input.resolution,ctx.requestId),ctx.requestId); });
