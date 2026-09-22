import { test, expect } from "@playwright/test";

test("popup provinsi: rangka dulu, isi menyusul", async ({ page }) => {
  await page.goto("/id");
  const bentang = page.locator('#lk-rel-kiri button[aria-label="Buka peta selayar"]').first();
  await bentang.waitFor({ state: "visible", timeout: 60_000 });
  await bentang.click();
  const overlay = page.locator("#lk-peta-selayar");
  await expect(overlay.locator("input.timeline-slider")).toBeVisible({ timeout: 60_000 });
  await expect(overlay.locator("div[aria-busy='true']")).toHaveCount(0, { timeout: 90_000 });

  // Cari titik di kanvas yang benar-benar poligon provinsi.
  const popup = page.locator(".peta-popup");
  let terbuka = false;
  for (const [fx, fy] of [[0.5, 0.5], [0.42, 0.55], [0.6, 0.45], [0.35, 0.5], [0.7, 0.55], [0.5, 0.62]]) {
    await page.mouse.click(1280 * fx, 800 * fy);
    if (await popup.isVisible().catch(() => false)) { terbuka = true; break; }
    await page.waitForTimeout(300);
  }
  expect(terbuka, "tak menemukan poligon provinsi di kanvas").toBe(true);

  // Rangka hadir lebih dulu…
  expect(await popup.locator(".animate-pulse").count()).toBe(1);
  // …lalu digantikan isi sungguhan.
  await expect(popup.locator(".animate-pulse")).toHaveCount(0, { timeout: 5_000 });
  await expect(popup.locator("h3, ul li button").first()).toBeVisible();
});
