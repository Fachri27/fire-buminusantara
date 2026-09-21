import { test } from "@playwright/test";
test.use({ launchOptions: { channel: "chrome" } });
test("windy controls", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("/id");
  await page.waitForTimeout(6000);
  // Cari pil mode Windy.
  const pil = page.getByRole("button", { name: /angin|windy|kualitas udara/i });
  console.log("PIL:", await pil.count());
  const label = await page.locator(".lk-bingkai-peta, #peta").first().evaluate((el) => el.innerHTML.slice(0, 0)).catch(() => "");
  // Klik pil kedua (windy) bila ada dua pil.
  const pils = page.locator("button").filter({ hasText: /angin dan kualitas udara/i });
  console.log("PIL2:", await pils.count());
  await page.screenshot({ path: "/tmp/wd0.png", clip: { x: 1050, y: 60, width: 550, height: 400 } });
});
