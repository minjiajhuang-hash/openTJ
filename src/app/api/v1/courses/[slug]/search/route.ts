import { searchCourse, requireCourseAccess } from "@/lib/server/courses";
import { apiData, withApi } from "@/lib/server/http";
type Context = { params: Promise<{ slug: string }> };
export const GET = withApi<Context>(async (request, context, ctx) => apiData(await searchCourse(await requireCourseAccess(request, (await context.params).slug), request.nextUrl.searchParams.get("q") ?? ""), ctx.requestId));
