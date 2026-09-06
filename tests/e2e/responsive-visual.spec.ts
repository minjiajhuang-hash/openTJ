import { expect, test } from "@playwright/test";

import { openSeededCourse, signInAs } from "./helpers";

test("ION-familiar shell stays within the viewport", async ({ page }, testInfo) => {
  await signInAs(page, "Student member");
  await openSeededCourse(page);

  const metrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    hasMain: Boolean(document.querySelector("main#main-content")),
  }));

  expect(metrics.hasMain).toBe(true);
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);

  if (testInfo.project.name === "mobile-chromium") {
    await expect(
      page.getByRole("button", { name: "Open navigation", exact: true }),
    ).toBeVisible();
  }

  await testInfo.attach(`course-shell-${testInfo.project.name}`, {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
});
