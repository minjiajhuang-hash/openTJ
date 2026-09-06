import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PDFDocument, PDFName, PDFString } from "pdf-lib";
try { process.loadEnvFile(); } catch { /* Environment supplied by caller. */ }
const base = process.env.APP_URL || "http://127.0.0.1:3000";
if (process.env.APP_ENV !== "local" || process.env.NODE_ENV === "production" || !["localhost", "127.0.0.1"].includes(new URL(base).hostname)) throw new Error("Run upload fixture tests only against a local development server with APP_ENV=local.");
async function login(persona) {
  const response = await fetch(`${base}/api/v1/auth/dev-login`, { method: "POST", headers: { origin: base, "content-type": "application/json" }, body: JSON.stringify({ persona }) });
  assert.equal(response.status, 200, await response.text());
  return response.headers.getSetCookie().find(value => value.startsWith("opentj_session=")).split(";", 1)[0];
}
const cookie = await login("student-member");
const nonmember = await login("student-nonmember");
async function mutate(path, body) {
  const response = await fetch(`${base}${path}`, { method: "POST", headers: { origin: base, cookie, "content-type": "application/json" }, body: JSON.stringify(body) });
  const value = await response.json(); assert.ok(response.ok, JSON.stringify(value)); return value.data;
}
const forged = await fetch(`${base}/api/v1/auth/session`, { headers: { cookie: "opentj_demo_persona=platform-admin" } });
assert.equal(forged.status, 401, "The obsolete persona cookie must not authenticate.");
const noOrigin = await fetch(`${base}/api/v1/auth/logout`, { method: "POST", headers: { cookie } });
assert.equal(noOrigin.status, 403, "Mutations require the configured origin.");
async function upload(pdf, key = randomUUID()) {
  const form = new FormData(); form.set("courseSlug", "concrete-math-av-p4"); form.set("file", new File([pdf], "Fictional upload validation.pdf", { type: "application/pdf" }));
  const response = await fetch(`${base}/api/v1/uploads`, { method: "POST", headers: { origin: base, cookie, "idempotency-key": key }, body: form });
  const body = await response.json(); assert.ok(response.ok, JSON.stringify(body)); return body.data;
}
const clean = await PDFDocument.create(); clean.addPage().drawText("Fictional PDF upload validation.");
const bytes = await clean.save();
const key = randomUUID(); const cleanUpload = await upload(bytes, key);
assert.equal((await upload(bytes, key)).id, cleanUpload.id, "Upload retries must be idempotent.");
const privateView = await fetch(`${base}/api/v1/uploads/${cleanUpload.id}/view`, { headers: { cookie: nonmember } });
assert.equal(privateView.status, 403, "A nonmember must not read course files.");
const early = await fetch(`${base}/api/v1/uploads/${cleanUpload.id}/view`, { headers: { cookie } });
// A warm container scanner can finish between upload and this read. Both paths
// are valid; successful reads must correspond to a verified CLEAN upload.
assert.ok([200, 409].includes(early.status), "Only clean files may be viewed.");
if (early.ok) {
  const state = await fetch(`${base}/api/v1/uploads/${cleanUpload.id}`, { headers: { cookie } });
  assert.equal((await state.json()).data.status, "CLEAN", "Unscanned bytes cannot be read.");
}
const note = await mutate("/api/v1/courses/concrete-math-av-p4/content", { kind: "NOTE", title: "Fictional PDF lifecycle verification", mode: "PDF", uploadId: cleanUpload.id });
assert.ok(["QUARANTINED", "PUBLISHED"].includes(note.visibility), "PDF notes either await scanning or have already passed it.");
const active = await PDFDocument.create(); active.addPage(); active.catalog.set(PDFName.of("OpenAction"), active.context.obj({ S: PDFName.of("JavaScript"), JS: PDFString.of("app.alert('test')") }));
const rejectedUpload = await upload(await active.save());
async function waitFor(id, expected) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const response = await fetch(`${base}/api/v1/uploads/${id}`, { headers: { cookie } }); const { data } = await response.json();
    if (data.status === expected) return data;
    assert.ok(!["FAILED", "REJECTED", "CLEAN"].includes(data.status), `Unexpected scan status: ${JSON.stringify(data)}`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error(`Timed out waiting for ${expected}`);
}
await waitFor(cleanUpload.id, "CLEAN"); await waitFor(rejectedUpload.id, "REJECTED");
const view = await fetch(`${base}/api/v1/uploads/${cleanUpload.id}/view`, { headers: { cookie } });
assert.equal(view.status, 200); assert.equal(view.headers.get("content-type"), "application/pdf"); assert.ok(view.headers.get("content-security-policy").includes("sandbox"));
assert.deepEqual(new Uint8Array(await view.arrayBuffer()), bytes);
const published = await fetch(`${base}/api/v1/courses/concrete-math-av-p4/content/${note.id}`, { headers: { cookie } });
const { data: readyNote } = await published.json(); assert.equal(readyNote.visibility, "PUBLISHED", "The worker publishes the note after a clean scan.");
await mutate(`/api/v1/courses/concrete-math-av-p4/content/${note.id}/visibility`, { version: readyNote.version, action: "hide" });
const hidden = await fetch(`${base}/api/v1/uploads/${cleanUpload.id}/view`, { headers: { cookie } });
assert.equal(hidden.status, 404, "Old PDF URLs stop working after a contribution is hidden.");
console.log("PASS: persisted session, forged-cookie rejection, Origin protection, private PDFs, idempotency, quarantine, real ClamAV clean scan, active-content rejection, sandboxed exact-byte viewing, automatic note publication, hidden-file denial.");
