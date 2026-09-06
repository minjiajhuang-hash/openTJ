import { requireCourseAccess } from "@/lib/server/auth";
import { editableContent } from "@/lib/server/practice";
import { apiData, withApi } from "@/lib/server/http";
type Context = { params: Promise<{ slug: string; id: string }> };
export const GET = withApi<Context>(async (request, context, ctx) => { const {slug,id} = await context.params; return apiData(await editableContent(await requireCourseAccess(request,slug),id),ctx.requestId); });
