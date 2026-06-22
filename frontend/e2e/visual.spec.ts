import { expect, test } from "@playwright/test";

test("command center visual smoke", async ({ page, isMobile }, testInfo) => {
  await page.goto("/");
  await expect(page.getByTestId("plant-map")).toBeVisible();

  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath(`command-center-${isMobile ? "mobile" : "desktop"}.png`),
  });
});
