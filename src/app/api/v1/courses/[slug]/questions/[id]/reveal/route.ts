import { z } from "zod";
import { requireCourseAccess } from "@/lib/server/auth";
import { revealSolution } from "@/lib/server/practice";
import { apiData, parseJson, requireSameOrigin, withApi } from "@/lib/server/http";
type Context = { params: Promise<{ slug: string; id: string }> };
export const POST = withApi<Context>(async (request, context, ctx) => { requireSameOrigin(request); const {slug,id} = await context.params; const input=await parseJson(request,z.object({revisionId:z.string().min(1)})); return apiData(await revealSolution(await requireCourseAccess(request,slug),id,input.revisionId),ctx.requestId); });
