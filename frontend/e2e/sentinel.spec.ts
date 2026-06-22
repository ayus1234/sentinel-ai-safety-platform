import { expect, test } from "@playwright/test";

test("critical scenario correlates evidence into one incident", async ({ page }) => {
  await page.goto("/");
  const runScenario = page.getByRole("button", { name: "Run critical scenario" });
  await expect(runScenario).toBeVisible();
  await runScenario.click();
  await expect(page.getByText("Explosion Risk = 97%"), "scenario reaches unified incident").toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("MUSTER A")).toBeVisible();
});

test("core operational views open", async ({ page, isMobile }) => {
  await page.goto("/");
  if (!isMobile) {
    await page.getByRole("button", { name: "Safety Memory" }).click();
    await expect(page.getByText("Live knowledge graph")).toBeVisible();
    await page.getByRole("button", { name: "Simulation" }).click();
    await expect(page.getByText("Failure simulation")).toBeVisible();
  } else {
    await expect(page.getByTestId("plant-map")).toBeVisible();
  }
});
