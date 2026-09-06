import { listCourses } from "@/lib/server/courses";
import { apiData, withApi } from "@/lib/server/http";
export const GET = withApi(async (request, _, ctx) => apiData(await listCourses(request), ctx.requestId));
