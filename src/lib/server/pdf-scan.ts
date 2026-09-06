import { Worker } from "node:worker_threads";
import { resolve, join, normalize } from "node:path";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { createConnection } from "node:net";

export class RejectedPdf extends Error {}
export async function inspectPdf(bytes: Buffer): Promise<number> {
  return new Promise((resolveResult, reject) => {
    const worker = new Worker(resolve("scripts/pdf-inspect.mjs"), {
      workerData: { bytes: new Uint8Array(bytes), maxPages: Math.min(Number(process.env.PDF_MAX_PAGES) || 200, 200) },
      resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 16, stackSizeMb: 4 },
    });
    const timer = setTimeout(() => { void worker.terminate(); reject(new RejectedPdf("PDF validation exceeded its time limit.")); }, 10_000);
    worker.once("message", (result: { ok: boolean; pages?: number; reason?: string }) => {
      clearTimeout(timer); void worker.terminate();
      if (!result.ok || !result.pages) reject(new RejectedPdf("This PDF is malformed, encrypted, too complex, or contains unsupported active content."));
      else resolveResult(result.pages);
    });
    worker.once("error", () => { clearTimeout(timer); reject(new RejectedPdf("PDF validation exceeded its resource limit.")); });
    worker.once("exit", (code) => { if (code !== 0) { clearTimeout(timer); reject(new RejectedPdf("PDF validation did not complete.")); } });
  });
}
export async function scanMalware(bytes: Buffer): Promise<void> {
  if (process.env.CLAMAV_COMMAND) {
    const directory = await mkdtemp(join(tmpdir(), "opentj-scan-"));
    const path = join(directory, "upload.pdf");
    try {
      await writeFile(path, bytes, { mode: 0o600 });
      const args = ["--no-summary", "--stdout", "--max-filesize=20M", "--max-scansize=40M", "--max-recursion=10"];
      if (process.env.CLAMAV_DATABASE) args.push(`--database=${normalize(process.env.CLAMAV_DATABASE)}`);
      args.push(path);
      await new Promise<void>((resolveResult, reject) => {
        execFile(normalize(process.env.CLAMAV_COMMAND!), args, { timeout: 90_000, maxBuffer: 8192, windowsHide: true }, (error) => {
          if (!error) resolveResult();
          else if (error.code === 1) reject(new RejectedPdf("The malware scanner rejected this file."));
          else reject(new Error("Malware scanner unavailable."));
        });
      });
    } finally { await rm(directory, { recursive: true, force: true }); }
    return;
  }
  await new Promise<void>((resolveResult, reject) => {
    const socket = createConnection({ host: process.env.CLAMAV_HOST || "127.0.0.1", port: Number(process.env.CLAMAV_PORT) || 3310 });
    let output = "";
    socket.setTimeout(90_000);
    socket.once("timeout", () => socket.destroy(new Error("Malware scanner timed out.")));
    socket.once("error", reject);
    socket.on("data", chunk => { output += chunk.toString(); if (output.length > 8192) socket.destroy(new Error("Invalid scanner response.")); });
    socket.once("end", () => {
      if (/FOUND/.test(output)) reject(new RejectedPdf("The malware scanner rejected this file."));
      else if (/^stream: OK\0?$/.test(output.trim())) resolveResult();
      else reject(new Error("Malware scanner did not confirm the file is clean."));
    });
    socket.once("connect", async () => {
      try {
        socket.write("zINSTREAM\0");
        for (let offset = 0; offset < bytes.length; offset += 64 * 1024) {
          const chunk = bytes.subarray(offset, offset + 64 * 1024);
          const length = Buffer.alloc(4); length.writeUInt32BE(chunk.length);
          socket.write(length);
          if (!socket.write(chunk)) await new Promise<void>(resolveDrain => socket.once("drain", resolveDrain));
        }
        socket.write(Buffer.alloc(4));
      } catch { socket.destroy(new Error("Malware scan failed.")); }
    });
  });
}
