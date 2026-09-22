import { test, expect } from "@playwright/test";

/* Regresi peta selayar beranda: overlay pernah memaksa
   `pointer-events: auto !important` ke SELURUH keturunannya, sehingga hamparan
   sinkronisasi PetaAsap (z-500, inset-0) yang sudah mematikan dirinya tetap
   menelan setiap sentuhan — peta tak bisa digeser dan slider linimasa tak bisa
   di-scrub. Yang diuji: titik tengah layar dan titik di atas slider benar-benar
   sampai ke kanvas peta / slider, bukan ke hamparan itu. */
test("kendali peta & linimasa hidup di mode selayar", async ({ page }) => {
  await page.goto("/id");

  const bentang = page.locator('#lk-rel-kiri button[aria-label="Buka peta selayar"]').first();
  await bentang.waitFor({ state: "visible", timeout: 60_000 });
  await bentang.click();

  const overlay = page.locator("#lk-peta-selayar");
  await expect(overlay).toBeVisible();

  const slider = overlay.locator("input.timeline-slider");
  await expect(slider).toBeVisible({ timeout: 60_000 });

  // Tunggu sinkronisasi selesai — hamparannya baru mematikan diri sesudah itu.
  await expect(overlay.locator("div[aria-busy='true']")).toHaveCount(0, { timeout: 90_000 });

  // Titik tengah overlay harus mendarat di kanvas MapLibre.
  const dibawahTengah = await page.evaluate(() => {
    const el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
    return el?.tagName.toLowerCase() ?? "";
  });
  expect(dibawahTengah).toBe("canvas");

  // Titik di tengah slider harus mendarat di slider itu sendiri.
  const kotak = (await slider.boundingBox())!;
  const dibawahSlider = await page.evaluate(
    ([x, y]) => {
      const el = document.elementFromPoint(x, y);
      return el instanceof HTMLInputElement ? el.className : (el as Element)?.className?.toString() ?? "";
    },
    [kotak.x + kotak.width / 2, kotak.y + kotak.height / 2],
  );
  expect(dibawahSlider).toContain("timeline-slider");

  // Dan scrub-nya benar-benar menggeser nilainya.
  await page.mouse.move(kotak.x + kotak.width * 0.2, kotak.y + kotak.height / 2);
  await page.mouse.down();
  await page.mouse.move(kotak.x + kotak.width * 0.8, kotak.y + kotak.height / 2, { steps: 8 });
  await page.mouse.up();
  expect(Number(await slider.inputValue())).toBeGreaterThan(0);
});
