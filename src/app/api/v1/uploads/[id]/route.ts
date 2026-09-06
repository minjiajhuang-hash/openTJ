import { apiData, withApi } from "@/lib/server/http";
import { authorizedUpload, publicUpload } from "@/lib/server/uploads";
export const GET = withApi<{ params: Promise<{ id: string }> }>(async (request, context, { requestId }) => {
  const { id } = await context.params;
  return apiData(publicUpload(await authorizedUpload(request, id)), requestId);
});
