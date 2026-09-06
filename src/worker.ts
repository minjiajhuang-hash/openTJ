import { db } from "./lib/server/db";
import { readObject } from "./lib/server/storage";
import { inspectPdf, RejectedPdf, scanMalware } from "./lib/server/pdf-scan";
import { sha256 } from "./lib/server/crypto";
import { runRetention } from "./lib/server/retention";
try { process.loadEnvFile(); } catch { /* Environment may be supplied directly. */ }

let stopped = false;
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => { stopped = true; });
export async function processNextUpload(): Promise<boolean> {
  // Recover work interrupted by a crash; a scan normally takes under two minutes.
  await db.upload.updateMany({ where: { status: "SCANNING", updatedAt: { lt: new Date(Date.now() - 5 * 60_000) } }, data: { status: "QUARANTINED", nextScanAt: new Date() } });
  const upload = await db.upload.findFirst({ where: { status: { in: ["PENDING", "QUARANTINED"] }, nextScanAt: { lte: new Date() } }, orderBy: { createdAt: "asc" } });
  if (!upload) return false;
  const claimed = await db.upload.updateMany({ where: { id: upload.id, status: upload.status }, data: { status: "SCANNING", scanAttempts: { increment: 1 } } });
  if (!claimed.count) return true;
  try {
    const bytes = await readObject(upload.objectKey);
    if (bytes.length !== upload.bytes || sha256(bytes) !== upload.sha256 || bytes.length > 20 * 1024 * 1024) throw new RejectedPdf("The stored file failed its integrity check.");
    const pages = await inspectPdf(bytes);
    await scanMalware(bytes);
    await db.$transaction(async tx => {
      await tx.upload.update({ where: { id: upload.id }, data: { status: "CLEAN", pages, failureReason: null } });
      // Never restore a file hidden by its author or a moderator during scanning.
      await tx.contentItem.updateMany({ where: { note: { uploadId: upload.id }, visibility: "QUARANTINED" }, data: { visibility: "PUBLISHED", publishedAt: new Date(), version: { increment: 1 } } });
    });
    console.log(JSON.stringify({ event: "upload_clean", uploadId: upload.id, pages }));
  } catch (error) {
    const rejected = error instanceof RejectedPdf;
    const exhausted = upload.scanAttempts + 1 >= 5;
    await db.upload.update({ where: { id: upload.id }, data: {
      status: rejected ? "REJECTED" : exhausted ? "FAILED" : "QUARANTINED",
      failureReason: rejected ? error.message : exhausted ? "Safety scanner remained unavailable after repeated attempts. Please upload the PDF again." : "Safety scanner is unavailable. This file remains private; retrying automatically.",
      nextScanAt: new Date(Date.now() + Math.min(300_000, 15_000 * 2 ** upload.scanAttempts)),
    } });
    console.warn(JSON.stringify({ event: rejected ? "upload_rejected" : "scan_unavailable", uploadId: upload.id }));
  }
  return true;
}
async function main() {
  console.log("PDF worker ready; unverified files remain quarantined.");
  let retentionAt = 0;
  while (!stopped) {
    try {
      if (Date.now() >= retentionAt) {
        const result = await runRetention();
        retentionAt = Date.now() + 60 * 60_000;
        if (result.expired || result.files || result.audit) console.log(JSON.stringify({ event: "retention_complete", ...result }));
      }
      if (!await processNextUpload()) { if (process.argv.includes("--once")) break; await new Promise(resolve => setTimeout(resolve, 2000)); }
    }
    catch { console.error(JSON.stringify({ event: "worker_dependency_unavailable" })); if (process.argv.includes("--once")) { process.exitCode = 1; break; } await new Promise(resolve => setTimeout(resolve, 5000)); }
  }
  await db.$disconnect();
}
void main();
