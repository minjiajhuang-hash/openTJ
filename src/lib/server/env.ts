import { z } from "zod";

const appEnvironmentSchema = z.enum(["local", "test", "staging", "production"]);

export type AppEnvironment = z.infer<typeof appEnvironmentSchema>;

export function getAppEnvironment(): AppEnvironment {
  const fallback = process.env.NODE_ENV === "production" ? "production" : "local";
  return appEnvironmentSchema.parse(process.env.APP_ENV ?? fallback);
}

export function isDemoAuthEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && getAppEnvironment() === "local" && process.env.DEMO_AUTH_ENABLED === "true";
}

export function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getAppUrl(): URL {
  const value = process.env.APP_URL?.trim() || "http://localhost:3000";
  return new URL(value);
}

export const POLICY_VERSION = "2026-09-v1";
export const SESSION_COOKIE = "opentj_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
export const OAUTH_COOKIE = "opentj_oauth_binding";
export function sessionCookieOptions() {
  return { httpOnly: true, sameSite: "lax" as const, secure: getAppUrl().protocol === "https:" || process.env.NODE_ENV === "production", path: "/", maxAge: SESSION_TTL_SECONDS };
}
