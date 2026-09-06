import { expect, type Page } from "@playwright/test";

export type DemoPersona =
  | "Student member"
  | "Student nonmember"
  | "Course staff"
  | "Platform administrator";

export async function signInAs(page: Page, persona: DemoPersona) {
  await page.goto("/login");
  const control = page
    .getByRole("button", { name: persona, exact: true })
    .or(page.getByRole("link", { name: persona, exact: true }))
    .first();
  await expect(control).toBeVisible();
  await control.click();
  await expect(page).toHaveURL(/\/courses(?:\/|$)/);
}

export async function openSeededCourse(page: Page) {
  const openCourse = page.locator('a[href="/courses/concrete-math-av-p4"]').filter({ hasText: "Open course" });
  await expect(openCourse).toBeVisible();
  await openCourse.click();
  await expect(
    page.getByRole("heading", { name: "Concrete Math AV - P4" }),
  ).toBeVisible();
}
