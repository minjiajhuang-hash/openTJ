import { courseSnapshot, requireCourseAccess } from "@/lib/server/courses";
import { apiData, withApi } from "@/lib/server/http";
type Context = { params: Promise<{ slug: string }> };
export const GET = withApi<Context>(async (request, context, ctx) => apiData(await courseSnapshot(await requireCourseAccess(request, (await context.params).slug)), ctx.requestId));
