import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

// PostgreSQL's Windows binaries still use ANSI paths internally. Relaunch Node
// preserving Windows 8.3 paths when a user profile has non-ASCII characters.
if (process.platform === "win32" && /[^\x20-\x7e]/.test(import.meta.url.replace(/%[0-9A-F]{2}/gi, "é")) && !process.env.OPENTJ_SHORT_PATH) {
  const short = execFileSync("powershell.exe", ["-NoProfile", "-Command", "$f=New-Object -ComObject Scripting.FileSystemObject; $f.GetFolder($env:OPENTJ_ROOT).ShortPath"], { env: { ...process.env, OPENTJ_ROOT: process.cwd() }, encoding: "utf8", windowsHide: true }).trim();
  execFileSync(process.execPath, ["--preserve-symlinks", "--preserve-symlinks-main", `${short}\\scripts\\local-db.mjs`], { env: { ...process.env, OPENTJ_SHORT_PATH: "1" }, cwd: short, stdio: "inherit", windowsHide: true });
  process.exit(0);
}

// A real PostgreSQL server, isolated to this repository; no service installation.
try { process.loadEnvFile(); } catch { /* Environment may be supplied directly. */ }
if (process.env.NODE_ENV === "production") throw new Error("Local database helper is for development only.");
const url = new URL(process.env.DATABASE_URL || "postgresql://opentj:opentj@localhost:54329/opentj");
if (!["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("Local database must bind to loopback.");
const directory = resolve("postgres-data");
const database = new EmbeddedPostgres({
  databaseDir: directory,
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  port: Number(url.port || 54329),
  persistent: true,
  authMethod: "scram-sha-256",
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  postgresFlags: ["-h", "127.0.0.1", "-c", "shared_buffers=32MB", "-c", "max_connections=40"],
  onLog: () => {},
  onError: (error) => console.error(String(error)),
});
if (!existsSync(resolve(directory, "PG_VERSION"))) await database.initialise();
await database.start();
const client = database.getPgClient();
await client.connect();
const name = url.pathname.slice(1);
if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) throw new Error("Use a simple local database name.");
const found = await client.query("SELECT 1 FROM pg_database WHERE datname=$1", [name]);
await client.end();
if (!found.rowCount) await database.createDatabase(name);
console.log(`Local PostgreSQL ready on 127.0.0.1:${url.port}; data in postgres-data/. Keep this terminal open.`);
const timer = setInterval(() => {}, 60_000);
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, async () => {
  clearInterval(timer);
  await database.stop();
  process.exit(0);
});
