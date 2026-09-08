import { existsSync } from "node:fs";

// Director supplies the database URL. Keep other secrets outside release folders.
const config = process.env.OPENTJ_ENV_FILE || "/site/private/opentj.env";
if (existsSync(config)) process.loadEnvFile(config);
else if (process.env.OPENTJ_ENV_FILE) throw new Error("Configured environment file is missing");
if (!process.env.DATABASE_URL && process.env.DIRECTOR_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.DIRECTOR_DATABASE_URL;
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing");
process.env.NODE_ENV = "production";
process.env.APP_ENV = "production";
process.env.DEMO_AUTH_ENABLED = "false";
process.env.HOSTNAME = process.env.HOST || "0.0.0.0";
process.env.PORT ||= "8080";
