import process from "node:process";

const production = process.env.NODE_ENV === "production" || process.env.APP_ENV === "production";
const errors = [];
const warnings = [];

function requireValue(name) {
  if (!process.env[name]?.trim()) errors.push(`${name} is required`);
}

function rejectPlaceholder(name, patterns) {
  const value = process.env[name] ?? "";
  if (patterns.some((pattern) => value.toLowerCase().includes(pattern))) {
    errors.push(`${name} still contains a development placeholder`);
  }
}

for (const name of ["APP_URL", "DATABASE_URL", "SESSION_SECRET"]) {
  requireValue(name);
}
if (process.env.STORAGE_DRIVER !== "local") for (const name of ["S3_BUCKET", "S3_ACCESS_KEY", "S3_SECRET_KEY"]) requireValue(name);
try {
  if (process.env.ION_REDIRECT_URI !== new URL("/api/v1/auth/ion/callback", process.env.APP_URL).href) errors.push("ION_REDIRECT_URI must exactly match APP_URL + /api/v1/auth/ion/callback");
} catch { errors.push("APP_URL must be a valid absolute URL"); }

if ((process.env.SESSION_SECRET?.length ?? 0) < 32) {
  errors.push("SESSION_SECRET must contain at least 32 characters");
}

if (production) {
  for (const name of ["ION_CLIENT_ID", "ION_CLIENT_SECRET", "ION_REDIRECT_URI"]) {
    requireValue(name);
  }
  if (process.env.STORAGE_DRIVER === "local") errors.push("Production requires private S3 storage");
  if (process.env.DEMO_AUTH_ENABLED === "true") {
    errors.push("DEMO_AUTH_ENABLED must not be true in production");
  }
  if (!process.env.APP_URL?.startsWith("https://")) {
    errors.push("APP_URL must use HTTPS in production");
  }
  rejectPlaceholder("SESSION_SECRET", ["replace", "development", "change-me"]);
  rejectPlaceholder("S3_SECRET_KEY", ["replace", "development", "change-me"]);
} else if (!process.env.ION_CLIENT_ID) {
  warnings.push("ION credentials are absent; only guarded development personas will be available");
}

for (const warning of warnings) console.warn(`warning: ${warning}`);
for (const error of errors) console.error(`error: ${error}`);

if (errors.length > 0) process.exit(1);
console.log(`Environment is valid for APP_ENV=${process.env.APP_ENV ?? "local"}.`);
