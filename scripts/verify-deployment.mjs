import assert from "node:assert/strict";
import { readFile, readdir, stat, writeFile, access } from "node:fs/promises";
import { resolve } from "node:path";

const directory = resolve(process.argv[2] || "release");
const rootPackage = JSON.parse(await readFile("package.json", "utf8"));
const operations = JSON.parse(await readFile(resolve(directory, "tasks/package.json"), "utf8"));
for (const [name, version] of Object.entries(operations.dependencies)) {
  assert.equal(version, rootPackage.dependencies[name] || rootPackage.devDependencies[name], `${name} must match the application`);
}
for (const path of ["web/server.js", "web/.next/static", "web/public", "web/node_modules/.prisma/client/schema.prisma", "tasks/node_modules/.prisma/client/schema.prisma", "tasks/node_modules/prisma/build/index.js", "tasks/src/worker.ts", "tasks/scripts/pdf-inspect.mjs", "tasks/prisma/migrations", "run.sh", "migrate.sh", "worker.sh", "load-env.mjs", "runtime-env.mjs", "check-env.mjs"]) {
  await access(resolve(directory, path));
}
for (const name of ["next", "vitest", "eslint", "playwright", "@playwright/test", "embedded-postgres", "typescript"]) {
  await assert.rejects(access(resolve(directory, "tasks/node_modules", name)), `${name} must not enter the operations package`);
}
async function inspect(path) {
  let bytes = 0;
  for (const entry of await readdir(path, { withFileTypes: true })) {
    assert.ok(entry.name !== ".env" && !entry.name.startsWith(".env."), "A dotenv file entered the deployment");
    const child = resolve(path, entry.name);
    if (entry.isDirectory()) bytes += await inspect(child);
    else if (entry.isFile()) bytes += (await stat(child)).size;
  }
  return bytes;
}
const metadata = {
  commit: process.env.GITHUB_SHA || "local",
  node: "22.9.0",
  platform: "linux-x64-debian-bookworm",
  webBytes: await inspect(resolve(directory, "web")),
  tasksBytes: await inspect(resolve(directory, "tasks")),
};
await writeFile(resolve(directory, "build-info.json"), JSON.stringify(metadata, null, 2) + "\n");
console.log(JSON.stringify(metadata));
