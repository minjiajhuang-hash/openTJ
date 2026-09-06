import { afterEach, describe, expect, it, vi } from "vitest";
import { createServer } from "node:net";
import { PDFDocument, PDFName, PDFString } from "pdf-lib";
import { inspectPdf, RejectedPdf, scanMalware } from "@/lib/server/pdf-scan";

afterEach(() => vi.unstubAllEnvs());

describe("resource-isolated PDF inspection", () => {
  it("accepts a regular PDF and returns its page count", async () => {
    const pdf = await PDFDocument.create(); pdf.addPage().drawText("Fictional notes");
    await expect(inspectPdf(Buffer.from(await pdf.save()))).resolves.toBe(1);
  });
  it("rejects active content hidden in compressed PDF objects", async () => {
    const pdf = await PDFDocument.create(); pdf.addPage();
    pdf.catalog.set(PDFName.of("OpenAction"), pdf.context.register(pdf.context.obj({ S: PDFName.of("JavaScript"), JS: PDFString.of("app.alert('test')") })));
    await expect(inspectPdf(Buffer.from(await pdf.save({ useObjectStreams: true })))).rejects.toBeInstanceOf(RejectedPdf);
  });
  it("rejects malformed files and excessive pages", async () => {
    await expect(inspectPdf(Buffer.from("%PDF-1.7 malformed"))).rejects.toBeInstanceOf(RejectedPdf);
    const pdf = await PDFDocument.create(); for (let page = 0; page < 201; page++) pdf.addPage();
    await expect(inspectPdf(Buffer.from(await pdf.save()))).rejects.toBeInstanceOf(RejectedPdf);
  });
});

describe("ClamAV INSTREAM transport", () => {
  it.each(["stream: OK\0", "stream: Test.Malware FOUND\0", "stream: scan ERROR\0"])("accepts only confirmed clean response %s", async response => {
    vi.stubEnv("CLAMAV_COMMAND", ""); vi.stubEnv("CLAMAV_HOST", "127.0.0.1");
    const received: Buffer[] = [];
    const server = createServer(socket => { socket.on("data", chunk => { received.push(chunk); const all = Buffer.concat(received); if (all.length >= 22) socket.end(response); }); });
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address(); if (!address || typeof address === "string") throw new Error("No test port");
    vi.stubEnv("CLAMAV_PORT", String(address.port));
    try {
      if (response === "stream: OK\0") await expect(scanMalware(Buffer.from("12345"))).resolves.toBeUndefined();
      else await expect(scanMalware(Buffer.from("12345"))).rejects.toThrow();
      const frame = Buffer.concat(received); expect(frame.subarray(0, 10).toString()).toBe("zINSTREAM\0"); expect(frame.readUInt32BE(10)).toBe(5); expect(frame.subarray(14, 19).toString()).toBe("12345"); expect(frame.readUInt32BE(19)).toBe(0);
    } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
  });
});
