import { test, expect } from "@playwright/test";

/** Asap perilaku landing index (/id) — struktur dan interaksi, toleran
 *  terhadap data (cukup 1 laporan tayang). Menggantikan peta.spec.ts yang
 *  mengasap konsol peta lama: index kini me-render LandingKarhutla. */

test.beforeEach(async ({ page }) => {
  await page.goto("/id");
  await expect(page.getByRole("heading", { name: /kebakaran hutan dan lahan/i }).first()).toBeVisible();
  await page.locator("main article").first().waitFor({ timeout: 30_000 });
});

test("kepala: merek, dan alih bahasa", async ({ page }) => {
  await expect(page.getByRole("link", { name: /peta sebaran/i }).first()).toHaveAttribute("href", "/id");
  await page.getByRole("link", { name: /ganti bahasa \(en\)/i }).click();
  await expect(page).toHaveURL(/\/en$/);
  await expect(page.getByRole("heading", { name: /forest and land fires/i }).first()).toBeVisible();
});

test("rel instrumen: lokasi, dan enam angka statistik", async ({ page }) => {
  test.skip(test.info().project.name === "mobile", "seluler: panel pindah ke /karhutla/panel");
  const panel = page.getByRole("complementary", { name: /panel situasi/i });
  await expect(panel).toBeVisible();
  await expect(panel.getByText(/secara otomatis dibaca lokasi/i)).toBeVisible();
  // Enam kartu bernilai format Indonesia (5.000 bawaan atau isi CMS).
  const angka = panel.locator("dd");
  expect(await angka.count()).toBe(6);
  for (const teks of await angka.allInnerTexts()) {
    expect(teks.trim()).toMatch(/^[\d.]+(,\d+)?$/);
  }
});

test("umpan: kartu tampil dan pencarian menyaring", async ({ page }) => {
  const umpan = page.getByRole("main", { name: /laporan warga/i });
  const kartu = umpan.locator("article");
  expect(await kartu.count()).toBeGreaterThanOrEqual(1);
  // Kolom cari dibuka lewat tombolnya dulu (di spanduk kepala, bukan tab bawah).
  await page.getByRole("banner", { name: /navigasi utama/i }).getByRole("button", { name: /cari laporan/i }).click();
  const cari = page.getByPlaceholder(/lapor apa yang kamu lihat/i);
  await expect(cari).toBeVisible();
  await cari.fill("zzzz-tidak-ada-yang-cocok");
  await expect(umpan.getByText(/tidak ada laporan yang cocok/i)).toBeVisible();
});

test("komposer: mengembang, validasi, tanpa pindah halaman", async ({ page }) => {
  await page.getByRole("button", { name: /apa yang terjadi di sekitarmu/i }).click();
  await page.locator("#lk-judul").fill("Judul uji");
  // Tanpa cerita + tanpa berkas: kiriman ditahan dengan galat, tetap di halaman.
  // Judul di luar <form> (form="lk-form") — cakup galat ke rel utama.
  await page.getByRole("button", { name: "Kirim", exact: true }).click();
  const umpan = page.getByRole("main", { name: /laporan warga/i });
  await expect(umpan.getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL(/\/id$/);
});

test("kartu membuka rincian lalu kembali (tetap di halaman)", async ({ page }) => {
  await page.locator("main article button").first().click();
  const dialog = page.locator('[aria-modal="true"]').last();
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(/\/id\/fire\//);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden({ timeout: 10_000 });
  await expect(page).toHaveURL(/\/id$/);
});

test("video umpan berputar saat terlihat", async ({ page }) => {
  const video = page.locator("main video").first();
  if ((await video.count()) === 0) test.skip(true, "tak ada laporan bervideo");
  await video.scrollIntoViewIfNeeded();
  await expect
    .poll(async () => video.evaluate((v) => !(v as HTMLVideoElement).paused), { timeout: 20_000 })
    .toBe(true);
});

test("seluler: bilah tab membuka panel lalu kembali", async ({ page }) => {
  test.skip(test.info().project.name !== "mobile", "khusus seluler");
  // Halaman utama seluler = daftar (tanpa peta WebGL).
  expect(await page.locator("aside").count()).toBe(0);
  expect(await page.locator("main article").count()).toBeGreaterThanOrEqual(1);
  await page.getByRole("link", { name: /buka panel situasi/i }).click();
  await expect(page).toHaveURL(/\/id\/karhutla\/panel$/);
  // Isi panel (lembar bawah seluler) tampil. Subtree rute lama ditahan App
  // Router dalam keadaan display:none — asersi visibilitas, bukan jumlah.
  await expect(page.getByText(/secara otomatis dibaca lokasi/i)).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("main article").first()).toBeHidden();
  await page.getByRole("link", { name: /buka daftar laporan/i }).click();
  await expect(page).toHaveURL(/\/id$/);
});

test("seluler: tombol ... membuka lembar deskripsi", async ({ page }) => {
  test.skip(test.info().project.name !== "mobile", "khusus seluler");
  await page.locator(".lk-kartu-titik").first().click();
  await expect(page.locator(".lk-lembar")).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: /buka laporan/i }).click();
  await expect(page.locator('[aria-modal="true"]').last()).toBeVisible({ timeout: 15_000 });
});
