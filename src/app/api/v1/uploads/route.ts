import { randomUUID } from "node:crypto";
import { fileTypeFromBuffer } from "file-type";
import { z } from "zod";
import { requireCourseAccess, requirePolicyAccepted, requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { sha256 } from "@/lib/server/crypto";
import { apiData, AppError, readLimitedBody, withApi } from "@/lib/server/http";
import { deleteObject, writeObject } from "@/lib/server/storage";
import { publicUpload } from "@/lib/server/uploads";

const maxBytes = Math.min(Number(process.env.PDF_MAX_BYTES) || 20 * 1024 * 1024, 20 * 1024 * 1024);
export const POST = withApi(async (request, _context, { requestId }) => {
  await requireUser(request);
  const key = z.string().uuid().parse(request.headers.get("idempotency-key"));
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data;")) throw new AppError(415, "PDF_REQUIRED", "Submit a PDF file.");
  const bytes = await readLimitedBody(request, maxBytes + 64 * 1024);
  const form = await new Response(new Uint8Array(bytes), { headers: { "content-type": request.headers.get("content-type")! } }).formData();
  const slug = z.string().min(1).max(100).parse(form.get("courseSlug"));
  const access = await requireCourseAccess(request, slug);
  await requirePolicyAccepted(access.user.id);
  const file = form.get("file");
  if (!(file instanceof File) || !file.size || file.size > maxBytes) throw new AppError(400, "PDF_SIZE_INVALID", "Choose a nonempty PDF no larger than 20 MiB.");
  const buffer = Buffer.from(await file.arrayBuffer());
  const type = await fileTypeFromBuffer(buffer);
  if (type?.mime !== "application/pdf" || buffer.subarray(0, 5).toString() !== "%PDF-") throw new AppError(400, "PDF_REQUIRED", "Only genuine PDF files are accepted.");
  const digest = sha256(buffer);
  const previous = await db.upload.findUnique({ where: { ownerId_idempotencyKey: { ownerId: access.user.id, idempotencyKey: key } } });
  if (previous) {
    if (previous.courseId !== access.course.id || previous.sha256 !== digest) throw new AppError(409, "IDEMPOTENCY_CONFLICT", "That upload key was already used for a different file.");
    return apiData(publicUpload(previous), requestId);
  }
  const objectKey = `quarantine/${randomUUID()}.pdf`;
  await writeObject(objectKey, buffer);
  try {
    const upload = await db.upload.create({ data: { courseId: access.course.id, ownerId: access.user.id, idempotencyKey: key, originalName: file.name.replace(/[\\/\x00-\x1f\x7f]/g, "_").slice(0, 150) || "notes.pdf", objectKey, bytes: file.size, detectedMime: type.mime, sha256: digest, status: "QUARANTINED" } });
    return apiData(publicUpload(upload), requestId, { status: 201 });
  } catch (error) { await deleteObject(objectKey); throw error; }
});
