import { expect, test } from "@playwright/test";

import { openSeededCourse, signInAs } from "./helpers";

test("development persona reaches the seeded course and every course section", async ({
  page,
}) => {
  await signInAs(page, "Student member");
  await expect(
    page.getByRole("heading", { name: "Courses", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Concrete Math AV - P4", { exact: true })).toBeVisible();

  await openSeededCourse(page);

  for (const tab of [
    "Calendar",
    "Assessments",
    "Notes",
    "Advice",
    "Sample Questions",
  ]) {
    const link = page.getByRole("link", { name: tab, exact: true });
    await expect(link).toBeVisible();
    await link.click();
    await expect(page.locator("main#main-content")).toBeVisible();
  }
});

test("production-facing login never asks for ION credentials", async ({ page }) => {
  await page.goto("/login");

  await expect(
    page.getByRole("link", { name: "Sign in with ION", exact: true }).or(
      page.getByRole("button", { name: "Sign in with ION", exact: true }),
    ),
  ).toBeVisible();
  await expect(page.getByLabel(/password/i)).toHaveCount(0);
  await expect(page.getByLabel(/one.?time|otp|2fa/i)).toHaveCount(0);
  await expect(page.getByText(/not an official/i)).toBeVisible();
});

test("protected course pages redirect an anonymous visitor to login", async ({
  page,
}) => {
  await page.goto("/courses/concrete-math-av-p4/notes");
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
});
