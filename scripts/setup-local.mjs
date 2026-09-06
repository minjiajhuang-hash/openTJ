import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
if (!existsSync(".env")) {
  const example = readFileSync(".env.example", "utf8")
    .replace("localhost:5432/opentj", "localhost:54329/opentj")
    .replace("replace-with-at-least-32-random-characters", randomBytes(32).toString("hex"));
  writeFileSync(".env", example, { mode: 0o600 });
  console.log("Created local .env with a random session secret.");
} else console.log("Existing .env preserved.");
