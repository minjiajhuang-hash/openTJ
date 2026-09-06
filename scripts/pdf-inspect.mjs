import { parentPort, workerData } from "node:worker_threads";
import { PDFDocument, PDFDict, PDFArray, PDFRawStream, PDFName } from "pdf-lib";

const forbidden = new Set(["JS", "JavaScript", "AA", "OpenAction", "Launch", "EmbeddedFiles", "EmbeddedFile", "RichMedia", "XFA", "AcroForm", "SubmitForm", "ImportData", "GoToR", "GoToE", "URI"]);
try {
  const pdf = await PDFDocument.load(workerData.bytes, { ignoreEncryption: false, throwOnInvalidObject: true, updateMetadata: false });
  if (pdf.isEncrypted) throw new Error("Encrypted PDFs are not accepted.");
  const pages = pdf.getPageCount();
  if (!pages || pages > workerData.maxPages) throw new Error("PDFs must contain between 1 and 200 pages.");
  const objects = pdf.context.enumerateIndirectObjects();
  if (objects.length > 100000) throw new Error("The PDF is too complex.");
  const seen = new Set();
  function inspect(object, depth = 0) {
    if (!object || seen.has(object)) return;
    if (depth > 100) throw new Error("The PDF is too complex.");
    seen.add(object);
    if (object instanceof PDFName && forbidden.has(object.decodeText())) throw new Error("PDFs containing scripts, embedded files, forms, or external actions are not accepted.");
    if (object instanceof PDFRawStream) inspect(object.dict, depth + 1);
    else if (object instanceof PDFDict) for (const [key, value] of object.entries()) { inspect(key, depth + 1); inspect(value, depth + 1); }
    else if (object instanceof PDFArray) for (const value of object.asArray()) inspect(value, depth + 1);
  }
  for (const [, object] of objects) inspect(object);
  parentPort.postMessage({ ok: true, pages });
} catch (error) { parentPort.postMessage({ ok: false, reason: error instanceof Error ? error.message : "The PDF could not be parsed." }); }
