import { expect, test } from "@playwright/test";

test("HTML responses set the expected browser security policy", async ({
  request,
}) => {
  const response = await request.get("/login");
  expect(response.ok()).toBeTruthy();

  const headers = response.headers();
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["content-security-policy"]).toContain("default-src 'self'");
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["content-security-policy"]).toContain("object-src 'none'");
});

test("health response is operational but does not expose secrets", async ({
  request,
}) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBeTruthy();
  const body = await response.text();
  expect(body).not.toMatch(/DATABASE_URL|SESSION_SECRET|ION_CLIENT_SECRET/i);
  expect(body).not.toMatch(/postgresql:\/\//i);
});
