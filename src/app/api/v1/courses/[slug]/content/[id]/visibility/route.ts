import { z } from "zod";
import { changeVisibility, requireCourseAccess } from "@/lib/server/content";
import { apiData, parseJson, requireSameOrigin, withApi } from "@/lib/server/http";
type Context = { params: Promise<{ slug: string; id: string }> };
export const POST = withApi<Context>(async (request, context, ctx) => { requireSameOrigin(request); const {slug,id} = await context.params; const input = await parseJson(request,z.object({version:z.number().int().positive(),action:z.enum(["hide","restore"])})); return apiData(await changeVisibility(await requireCourseAccess(request,slug),id,input.version,input.action),ctx.requestId); });
