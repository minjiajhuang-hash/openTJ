import { AppError, withApi } from "@/lib/server/http";
import { sha256 } from "@/lib/server/crypto";
import { authorizedUpload } from "@/lib/server/uploads";
import { readObject } from "@/lib/server/storage";
export const GET = withApi<{ params: Promise<{ id: string }> }>(async (request, context) => {
  const { id } = await context.params;
  const upload = await authorizedUpload(request, id, true);
  const bytes = await readObject(upload.objectKey);
  if (bytes.length !== upload.bytes || sha256(bytes) !== upload.sha256) throw new AppError(409, "FILE_INTEGRITY_FAILED", "This file failed its integrity check.");
  return new Response(new Uint8Array(bytes), { headers: {
    "content-type": "application/pdf", "content-length": String(bytes.length),
    "content-disposition": `inline; filename="notes.pdf"; filename*=UTF-8''${encodeURIComponent(upload.originalName)}`,
    "content-security-policy": "sandbox; default-src 'none'; frame-ancestors 'self'",
    "x-content-type-options": "nosniff", "cache-control": "private, no-store",
  } });
});
