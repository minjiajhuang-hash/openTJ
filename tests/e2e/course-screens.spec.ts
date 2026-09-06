import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

test("course screens remain accessible in dark mode at each viewport", async ({ page }, info) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await signInAs(page, "Student member");
  await page.getByRole("button", { name: "Theme: system. Change theme" }).click();
  await page.getByRole("button", { name: "Theme: light. Change theme" }).click();
  for (const [section, title] of [["calendar", "Calendar"], ["assessments", "Assessments"], ["notes", "Notes"], ["advice", "Advice"], ["questions", "Sample Questions"]]) {
    await page.goto(`/courses/concrete-math-av-p4/${section}`);
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    const width = await page.evaluate(() => ({ actual: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth }));
    expect(width.actual, section).toBeLessThanOrEqual(width.viewport + 1);
    const scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(scan.violations, section).toEqual([]);
    await info.attach(`${section}-dark-${info.project.name}`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  }
  expect(errors).toEqual([]);
});

test("calendar saves an event and attributed update across reload", async ({ page }, info) => {
  await signInAs(page, "Student member");
  await page.goto("/courses/concrete-math-av-p4/calendar");
  await page.getByRole("button", { name: "Add event", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const title = `Fictional calendar check ${info.project.name} ${Date.now()}`;
  const date = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  await dialog.getByLabel("Title", { exact: true }).fill(title);
  await dialog.getByLabel("Start date", { exact: true }).fill(date);
  await dialog.getByLabel("Details", { exact: true }).fill("Fictional reminder created by automated local verification.");
  const policy = dialog.getByRole("checkbox", { name: /read and accept/ });
  if (await policy.count()) await policy.check();
  await dialog.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  // Agenda exposes every event even when the month grid collapses a busy day.
  await page.getByRole("button", { name: "Agenda", exact: true }).click();
  await page.locator(".fc-list-event-title").getByText(title, { exact: true }).click();
  const selected = page.getByRole("complementary", { name: "Selected calendar item" });
  await expect(selected.getByRole("heading", { name: title, exact: true })).toBeVisible();
  await selected.getByRole("button", { name: "Add attributed update" }).click();
  const update = `Fictional shared update ${Date.now()}`;
  await dialog.getByLabel("Content", { exact: true }).fill(update);
  await dialog.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(selected.getByText(update, { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Agenda", exact: true }).click();
  await page.locator(".fc-list-event-title").getByText(title, { exact: true }).click();
  await expect(selected.getByText(update, { exact: true })).toBeVisible();
});
