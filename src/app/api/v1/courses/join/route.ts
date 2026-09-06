import { z } from "zod";
import { joinCourse } from "@/lib/server/courses";
import { apiData, parseJson, requireSameOrigin, withApi } from "@/lib/server/http";
export const POST = withApi(async (request, _, ctx) => { requireSameOrigin(request); const input = await parseJson(request, z.object({ code: z.string().trim().min(1).max(100) })); return apiData(await joinCourse(request, input.code), ctx.requestId); });
