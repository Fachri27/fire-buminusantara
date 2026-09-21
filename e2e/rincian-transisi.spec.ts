import { test, expect } from "@playwright/test";

// Pop-up rincian ditahan satu animasi sebelum induknya membongkarnya. Yang
// diuji: kelas keluar terpasang saat ditutup, DAN pop-upnya benar-benar lepas
// sesudahnya — kalau animationend tak pernah menyala (mis. keyframes keluar
// dipakai ulang dari animasi masuk), pop-up macet terbuka dan uji ini merah.
test("rincian: animasi masuk, lalu keluar sampai lepas", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/id/karhutla");
  await page.locator(".korsel-kartu, .lk-kartu, [data-kartu-kejadian]").first().click();

  const popup = page.locator(".rincian");
  await expect(popup).toBeVisible({ timeout: 30_000 });
  await expect(popup.locator(".rincian__panel")).toHaveCSS("animation-name", "rincian-panel-muncul");

  await popup.locator(".rincian__tutup").click();
  await expect(popup).toHaveClass(/rincian--keluar/);
  await expect(popup).toHaveCount(0, { timeout: 3_000 });
});

// Jalur hemat gerak: tutup seketika lewat JS, tak menunggu animasi apa pun.
test("rincian: reduced-motion menutup seketika", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/id/karhutla");
  await page.locator(".korsel-kartu, .lk-kartu, [data-kartu-kejadian]").first().click();

  const popup = page.locator(".rincian");
  await expect(popup).toBeVisible({ timeout: 30_000 });
  await popup.locator(".rincian__tutup").click();
  await expect(popup).toHaveCount(0, { timeout: 500 });
});

// Kedipan slider: slide yang masuk sempat selebar 0 karena rasio aslinya baru
// terbaca saat medianya termuat — dan media di luar layar baru diunduh persis
// ketika ia bergeser masuk. Yang diuji bagian yang tak bergantung balapan
// jaringan: begitu modal terbuka, tak boleh ada bingkai slide selebar 0.
test("slider rincian: tak ada bingkai slide selebar 0", async ({ page }) => {
  await page.goto("/id/karhutla");
  const kartu = page.locator(".korsel-kartu, .lk-kartu, [data-kartu-kejadian]");
  const n = await kartu.count();

  let ketemu = false;
  for (let i = 0; i < n; i++) {
    await kartu.nth(i).click();
    const popup = page.locator(".rincian");
    await expect(popup).toBeVisible({ timeout: 30_000 });
    if (await popup.locator(".rincian__slider-tombol").count()) {
      ketemu = true;
      const lebar = await popup.locator(".rincian__slide-bingkai").evaluateAll(
        (el) => el.map((e) => Math.round(e.getBoundingClientRect().width)));
      expect(lebar, `bingkai runtuh ke lebar 0: ${JSON.stringify(lebar)}`)
        .not.toContain(0);
      break;
    }
    await page.keyboard.press("Escape");
    await expect(popup).toHaveCount(0, { timeout: 3_000 });
  }
  expect(ketemu, "tak ada kejadian bermedia jamak untuk diuji").toBe(true);
});
