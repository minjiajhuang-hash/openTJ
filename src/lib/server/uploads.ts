import { type Upload } from "@prisma/client";
import { requireCourseAccess, requireUser } from "./auth";
import { db } from "./db";
import { AppError } from "./http";

export function publicUpload(upload: Upload) {
  return { id: upload.id, status: upload.status, originalName: upload.originalName, bytes: upload.bytes, pages: upload.pages, failureReason: upload.failureReason, viewUrl: upload.status === "CLEAN" ? `/api/v1/uploads/${upload.id}/view` : null };
}
export async function authorizedUpload(request: Request, id: string, viewing = false) {
  const user = await requireUser(request);
  const upload = await db.upload.findUnique({ where: { id }, include: { course: { select: { slug: true } }, note: { include: { contentItem: true } } } });
  if (!upload) throw new AppError(404, "UPLOAD_NOT_FOUND", "File not found.");
  const access = await requireCourseAccess(request, upload.course.slug);
  const item = upload.note?.contentItem;
  // A removed/hidden contribution cannot be fetched through an old direct URL.
  if (item && item.visibility !== "PUBLISHED" && !(item.visibility === "QUARANTINED" && !viewing && (user.id === upload.ownerId || access.canModerate))) throw new AppError(404, "UPLOAD_NOT_FOUND", "File not found.");
  if (!item && upload.ownerId !== user.id && !access.canModerate) throw new AppError(404, "UPLOAD_NOT_FOUND", "File not found.");
  if (viewing && upload.status !== "CLEAN") throw new AppError(409, "UPLOAD_QUARANTINED", "This PDF is not available until safety checks succeed.");
  return upload;
}
