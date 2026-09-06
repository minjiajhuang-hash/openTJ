import { requireUser } from "@/lib/server/auth";
import { privateHistory } from "@/lib/server/practice";
import { db } from "@/lib/server/db";
import { apiData, parsePagination, requireSameOrigin, withApi } from "@/lib/server/http";
export const GET = withApi(async (request, _, ctx) => { const user=await requireUser(request); const {limit,cursor}=parsePagination(request.nextUrl); return apiData(await privateHistory(user.id,limit,cursor),ctx.requestId); });
export const DELETE = withApi(async (request, _, ctx) => { requireSameOrigin(request); const user=await requireUser(request); const result=await db.practiceAttempt.deleteMany({where:{userId:user.id}}); return apiData({cleared:result.count},ctx.requestId); });
