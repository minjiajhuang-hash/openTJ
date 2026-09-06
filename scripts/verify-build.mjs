import assert from "node:assert/strict";
import { readdir, unlink, access } from "node:fs/promises";
import { resolve } from "node:path";

// Next copies loaded dotenv files into standalone output independently of output
// tracing exclusions. Deployment must receive secrets from its environment.
const directory = resolve(".next", "standalone");
for (const entry of await readdir(directory, { withFileTypes: true })) {
  if (entry.name === ".env" || entry.name.startsWith(".env.")) {
    assert.ok(entry.isFile(), "Unexpected dotenv directory in build output");
    await unlink(resolve(directory, entry.name));
  }
}
const names = await readdir(directory);
for (const forbidden of ["postgres-data", "clamav-data", "minio-data", "uploads", "test-results", "playwright-report", "coverage"]) {
  assert.ok(!names.includes(forbidden), `Runtime data entered the build: ${forbidden}`);
}
await access(resolve(directory, "server.js"));
console.log("Standalone package verified: server present, no dotenv files or runtime data.");
