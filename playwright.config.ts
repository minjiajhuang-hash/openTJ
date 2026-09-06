import { defineConfig, devices } from "@playwright/test";

try { process.loadEnvFile(); } catch { /* CI supplies its environment directly. */ }

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [["line"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  timeout: 30_000,
  expect: {
    timeout: 7_500,
  },
  use: {
    baseURL,
    locale: "en-US",
    timezoneId: "America/New_York",
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  outputDir: "test-results",
  projects: [
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "tablet-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 768, height: 1024 },
      },
    },
    {
      name: "mobile-chromium",
      use: {
        ...devices["Pixel 7"],
        viewport: { width: 390, height: 844 },
      },
    },
  ],
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : {
        command: "npm run dev -- --hostname 127.0.0.1",
        url: `${baseURL}/api/health`,
        reuseExistingServer: true,
        timeout: 120_000,
        env: {
          APP_ENV: "local",
          DEMO_AUTH_ENABLED: "true",
          APP_URL: baseURL,
          DATABASE_URL:
            process.env.DATABASE_URL ??
            "postgresql://opentj:opentj@127.0.0.1:5432/opentj?schema=public",
          SESSION_SECRET:
            process.env.SESSION_SECRET ??
            "playwright-only-session-secret-at-least-32-characters",
          ...process.env,
        },
      },
});
