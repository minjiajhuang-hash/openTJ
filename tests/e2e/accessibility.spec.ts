import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { openSeededCourse, signInAs } from "./helpers";

test("login has no automatically detectable WCAG A/AA violations", async ({
  page,
}) => {
  await page.goto("/login");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});

test("course shell is keyboard reachable and passes an axe scan", async ({
  page,
}) => {
  await signInAs(page, "Student member");
  await openSeededCourse(page);

  const skipLink = page.getByRole("link", { name: /skip to (main )?content/i });
  await page.reload();
  await page.keyboard.press("Tab");
  await expect(skipLink).toBeFocused();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});
