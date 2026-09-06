import { z } from "zod";
import { contentInclude, serializeManyContent, visibleWhere, writeContent, requireCourseAccess } from "@/lib/server/content";
import { db } from "@/lib/server/db";
import { apiData, parseJson, parsePagination, requireSameOrigin, withApi } from "@/lib/server/http";
type Context = { params: Promise<{ slug: string }> };
export const GET = withApi<Context>(async (request, context, ctx) => { const access = await requireCourseAccess(request, (await context.params).slug); const {limit,cursor} = parsePagination(request.nextUrl); const kind = z.enum(["ASSESSMENT","CALENDAR_EVENT","CALENDAR_UPDATE","NOTE","ADVICE","QUESTION"]).parse(request.nextUrl.searchParams.get("kind")); const items = await db.contentItem.findMany({where:{...visibleWhere(access),kind},take:limit+1,orderBy:[{createdAt:"desc"},{id:"desc"}],...(cursor ? {cursor:{id:cursor},skip:1} : {}),include:contentInclude}); return apiData({items:await serializeManyContent(items.slice(0,limit),access),nextCursor:items.length>limit?items[limit-1]?.id??null:null},ctx.requestId); });
export const POST = withApi<Context>(async (request, context, ctx) => { requireSameOrigin(request); const access = await requireCourseAccess(request, (await context.params).slug); return apiData(await writeContent(access, await parseJson(request, z.record(z.string(), z.unknown()))), ctx.requestId, { status: 201 }); });
