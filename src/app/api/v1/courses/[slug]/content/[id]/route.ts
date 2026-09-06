import { z } from "zod";
import { getContent, serializeContentForRead, writeContent, requireCourseAccess } from "@/lib/server/content";
import { apiData, parseJson, requireSameOrigin, withApi } from "@/lib/server/http";
type Context = { params: Promise<{ slug: string; id: string }> };
export const GET = withApi<Context>(async (request, context, ctx) => { const {slug,id} = await context.params; const access = await requireCourseAccess(request,slug); return apiData(await serializeContentForRead(await getContent(access,id),access),ctx.requestId); });
export const PATCH = withApi<Context>(async (request, context, ctx) => { requireSameOrigin(request); const {slug,id} = await context.params; return apiData(await writeContent(await requireCourseAccess(request,slug), await parseJson(request,z.record(z.string(),z.unknown())),id),ctx.requestId); });
