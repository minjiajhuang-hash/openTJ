import { requireCourseAccess, assertCanChangeContent } from "@/lib/server/auth";
import { getContent } from "@/lib/server/content";
import { db } from "@/lib/server/db";
import { apiData, withApi } from "@/lib/server/http";
type Context = { params: Promise<{ slug: string; id: string }> };
export const GET = withApi<Context>(async (request, context, ctx) => { const {slug,id} = await context.params; const access = await requireCourseAccess(request,slug); const item = await getContent(access,id); await assertCanChangeContent(access.user.id,item); const revisions = await db.contentRevision.findMany({where:{contentItemId:id},orderBy:{revision:"desc"},take:100,select:{id:true,revision:true,snapshot:true,createdAt:true,editor:{select:{displayName:true,username:true}}}}); return apiData({revisions},ctx.requestId); });
