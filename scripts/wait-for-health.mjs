import process from "node:process";

const url = process.env.HEALTH_URL ?? "http://127.0.0.1:3000/api/health";
const timeoutMs = Number(process.env.HEALTH_TIMEOUT_MS ?? 240_000);
const intervalMs = Number(process.env.HEALTH_INTERVAL_MS ?? 2_000);
const deadline = Date.now() + timeoutMs;
let lastFailure = "no response";

while (Date.now() < deadline) {
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(Math.min(intervalMs, 5_000)),
    });

    if (response.ok) {
      const payload = await response.json();
      if (payload.status === "ok" || payload.ok === true) {
        console.log(`openTJ is healthy at ${url}`);
        process.exit(0);
      }
      lastFailure = `unexpected payload: ${JSON.stringify(payload)}`;
    } else {
      lastFailure = `HTTP ${response.status}`;
    }
  } catch (error) {
    lastFailure = error instanceof Error ? error.message : String(error);
  }

  await new Promise((resolve) => setTimeout(resolve, intervalMs));
}

console.error(`Timed out waiting for ${url}: ${lastFailure}`);
process.exit(1);
