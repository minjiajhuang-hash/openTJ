import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

assert.equal(process.version, "v22.9.0");
const directory = "/release";
const env = {
  ...process.env,
  PORT: "18080",
  APP_URL: "https://opentj.example.test",
  ION_REDIRECT_URI: "https://opentj.example.test/api/v1/auth/ion/callback",
  ION_CLIENT_ID: "smoke-test-only",
  ION_CLIENT_SECRET: "smoke-test-only",
  SESSION_SECRET: "smoke-test-secret-with-more-than-thirty-two-characters",
  STORAGE_DRIVER: "s3",
  S3_BUCKET: "smoke-test-only",
  S3_ACCESS_KEY: "smoke-test-only",
  S3_SECRET_KEY: "smoke-test-only",
};
function task(script, args = []) {
  const result = spawnSync("sh", [script, ...args], { cwd: directory, env, stdio: "inherit", timeout: 120_000 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, `${script} failed`);
}
task("migrate.sh");
task("worker.sh", ["--once"]);
const web = spawn("sh", ["run.sh"], { cwd: directory, env, stdio: "inherit" });
let spawnError;
web.on("error", error => { spawnError = error; });
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    assert.ifError(spawnError);
    assert.equal(web.exitCode, null, "Web server exited before becoming ready");
    try {
      const response = await fetch("http://127.0.0.1:18080/api/health");
      if (response.ok) { ready = true; break; }
    } catch { /* Startup may still be in progress. */ }
    await delay(500);
  }
  assert.ok(ready, "Packaged web server did not become healthy");
  const page = await fetch("http://127.0.0.1:18080/login");
  assert.equal(page.status, 200);
  const html = await page.text();
  const asset = html.match(/(?:src|href)="(\/_next\/static\/[^"?]+(?:\?[^" ]*)?)"/);
  assert.ok(asset, "Login page references no static assets");
  assert.equal((await fetch(`http://127.0.0.1:18080${asset[1].replaceAll("&amp;", "&")}`)).status, 200);
  const login = await fetch("http://127.0.0.1:18080/api/v1/auth/dev-login", {
    method: "POST", headers: { "Content-Type": "application/json", Origin: env.APP_URL }, body: JSON.stringify({ persona: "student" }),
  });
  assert.ok(login.status >= 400, "Production package exposed development login");
  const status = await readFile(`/proc/${web.pid}/status`, "utf8");
  console.log(`Packaged web process after health/login/static requests: ${status.match(/^VmRSS:.*$/m)?.[0]}`);
  console.log("PASS: archive migrations, production seed, worker startup, web health, static assets and disabled development login");
} finally {
  web.kill("SIGTERM");
  await Promise.race([new Promise(resolve => web.once("exit", resolve)), delay(10_000)]);
  if (web.exitCode === null && web.signalCode === null) web.kill("SIGKILL");
}
