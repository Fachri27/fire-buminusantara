import { test, expect } from "@playwright/test";

/** Asap perilaku konsol /peta — struktur, bukan isi: toleran terhadap data
 *  (cukup 1 laporan tayang), tegas pada interaksi. */
test.beforeEach(async ({ page }) => {
  await page.goto("/id/peta");
  await expect(page.getByRole("heading", { name: /peta sebaran/i }).first()).toBeVisible();
});

test("rel kanan: kelompok terbaru + terpopuler berpemisah", async ({ page }) => {
  const terbaru = page.getByRole("region", { name: "Laporan terbaru" });
  await expect(terbaru.getByRole("heading", { name: "Laporan terbaru" })).toBeVisible();

  const kartuBaru = terbaru.getByRole("button", { name: /buka rincian/i });
  expect(await kartuBaru.count()).toBeGreaterThanOrEqual(1);
  expect(await kartuBaru.count()).toBeLessThanOrEqual(5);

  const populer = page.getByRole("region", { name: "Terpopuler" });
  if ((await populer.count()) > 0) {
    const kartuRamai = populer.getByRole("button", { name: /buka rincian/i });
    expect(await kartuRamai.count()).toBeLessThanOrEqual(5);
    // Garis pemisah antar kelompok — bukan sekadar jarak.
    await expect(populer).toHaveCSS("border-top-width", "1px");
    const total = (await kartuBaru.count()) + (await kartuRamai.count());
    expect(total).toBeLessThanOrEqual(10);
  }
});

test("pop-up wilayah terbuka dari daftar provinsi", async ({ page }) => {
  // <aside aria-label> tanpa role eksplisit dipetakan ke `complementary`,
  // bukan `region` — getByRole("region") tak pernah cocok (strict-mode
  // timeout walau tombolnya terlihat di snapshot).
  const rel = page.getByRole("complementary", { name: "Provinsi" });
  await rel.getByRole("button", { name: /^jawa barat,/i }).click();

  const dialog = page.getByRole("dialog", { name: /wilayah terpilih/i });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("tab tepi melipat dan membuka rel kiri (panggung)", async ({ page }) => {
  // Tab lipat hanya tampil di mode panggung (≥1100px & ≥640px tinggi);
  // di aliran (mobile) ia hidden dan rel selalu terbuka — lewati.
  test.skip((page.viewportSize()?.width ?? 0) < 1100, "hanya panggung yang punya tab lipat");

  const tutup = page.getByRole("button", { name: /tutup panel provinsi/i });
  await expect(tutup).toBeVisible();
  const cari = page.getByRole("searchbox", { name: /cari provinsi/i });
  await expect(cari).toBeVisible();

  await tutup.click();
  await expect(cari).toBeHidden();

  await page.getByRole("button", { name: /buka panel provinsi/i }).click();
  await expect(cari).toBeVisible();

  // Lepas peta WebGL sebelum context ditutup — kalau tidak, teardown
  // menggantung menunggu request tile/Zarr yang masih terbuka.
  await page.goto("about:blank");
});

test("kartu membuka rincian lalu kembali ke peta", async ({ page }) => {
  await page
    .getByRole("region", { name: "Laporan terbaru" })
    .getByRole("button", { name: /buka rincian/i })
    .first()
    .click();

  const dialog = page.getByRole("dialog", { name: /rincian laporan/i });
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/\/fire\//);

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/peta/);

  // Lepas peta WebGL sebelum context ditutup — kalau tidak, teardown
  // menggantung menunggu request tile/Zarr yang masih terbuka.
  await page.goto("about:blank");
});
