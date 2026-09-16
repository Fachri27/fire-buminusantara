import { test, expect } from "@playwright/test";

/** Asap perilaku konsol peta (index /id) — struktur, bukan isi: toleran
 *  terhadap data (cukup 1 laporan tayang), tegas pada interaksi. */
test.beforeEach(async ({ page }) => {
  await page.goto("/id");
  await expect(page.getByRole("heading", { name: /peta sebaran/i }).first()).toBeVisible();
});

/** true di layar sempit: kedua rel disembunyikan (aliran:hidden) dan isinya
 *  pindah ke LaciPeta di atas peta — ambang yang sama dengan test tab tepi. */
function aliran(page: { viewportSize(): { width: number; height: number } | null }) {
  return (page.viewportSize()?.width ?? 0) < 1100;
}

test("rel kanan: kelompok terbaru + terpopuler berpemisah", async ({ page }) => {
  if (aliran(page)) {
    // Mobile: rel kanan hidden, laci mengintip menampilkan deret kartu
    // laporan (terbaru + populer) yang bisa digeser.
    const laci = page.getByRole("region", { name: /laporan dan wilayah/i });
    await expect(laci).toBeVisible();
    const kartu = laci.getByRole("button", { name: /buka rincian/i });
    expect(await kartu.count()).toBeGreaterThanOrEqual(1);
    expect(await kartu.count()).toBeLessThanOrEqual(10);
    return;
  }
  // <aside> tanpa role eksplisit dipetakan ke `complementary` (lihat komentar
  // di test pop-up wilayah di bawah); <h3> kelompok kini dikomentari di
  // halaman-peta.tsx, tinggal <h2 class="sr-only"> — tetap terikat (attached)
  // tapi tak visible, jadi asersinya dipakai secukupnya. Hitungan kartu
  // dicakup ke <section> dalam (satu kelompok ≤5), bukan seluruh aside.
  const panel = page.getByRole("complementary", { name: "Laporan terbaru" });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("heading", { name: "Laporan terbaru" })).toBeAttached();

  const terbaru = panel.getByRole("region", { name: "Laporan terbaru" });
  const kartuBaru = terbaru.getByRole("button", { name: /buka rincian/i });
  expect(await kartuBaru.count()).toBeGreaterThanOrEqual(1);
  expect(await kartuBaru.count()).toBeLessThanOrEqual(5);

  const populer = page.getByRole("region", { name: "Terpopuler" });
  if ((await populer.count()) > 0) {
    const kartuRamai = populer.getByRole("button", { name: /buka rincian/i });
    expect(await kartuRamai.count()).toBeLessThanOrEqual(5);
    const total = (await kartuBaru.count()) + (await kartuRamai.count());
    expect(total).toBeLessThanOrEqual(10);
  }
});

test("pop-up wilayah terbuka dari daftar provinsi", async ({ page }) => {
  if (aliran(page)) {
    // Mobile: daftar provinsi ada di tab Wilayah laci — buka laci lewat
    // pegangannya, pindah ke tab Wilayah, baru tekan provinsinya.
    const laci = page.getByRole("region", { name: /laporan dan wilayah/i });
    await laci.getByRole("button", { name: /tampilkan laporan dan wilayah/i }).click();
    await laci.getByRole("tab", { name: /wilayah/i }).click();
    await laci.getByRole("button", { name: "Jawa Barat", exact: true }).click();
  } else {
    // <aside aria-label> tanpa role eksplisit dipetakan ke `complementary`,
    // bukan `region` — getByRole("region") tak pernah cocok (strict-mode
    // timeout walau tombolnya terlihat di snapshot).
    const rel = page.getByRole("complementary", { name: "Provinsi" });
    // Tombol provinsi me-render nama polos ({nama} di KelompokWilayah,
    // halaman-peta.tsx); pola "nama, provinsi" hanya dipakai tombol kabupaten
    // lewat aria-label — jadi cocokkan nama persisnya.
    await rel.getByRole("button", { name: "Jawa Barat", exact: true }).click();
  }

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
  // Nama aksesibel mengikuti teks.cari ("Cari wilayah atau laporan",
  // lib/bahasa.ts) — bukan "cari provinsi".
  const cari = page.getByRole("searchbox", { name: /cari wilayah/i });
  await expect(cari).toBeVisible();

  // TabRel beranimasi apung infinite (tab-rel-apung di halaman-peta.tsx),
  // jadi tak pernah "stable" bagi Playwright — klik paksa, animasinya
  // dekoratif dan tak mengubah hit-target.
  await tutup.click({ force: true });
  // Rel dilipat dengan menyusutkan lajur grid + opacity-0 (bukan
  // display:none), jadi inputnya tetap "visible" bagi Playwright walau
  // terklip tak terlihat — bukti melipatnya adalah label tab yang berganti.
  const buka = page.getByRole("button", { name: /buka panel provinsi/i });
  await expect(buka).toBeVisible();

  await buka.click({ force: true });
  await expect(cari).toBeVisible();

  // Lepas peta WebGL sebelum context ditutup — kalau tidak, teardown
  // menggantung menunggu request tile/Zarr yang masih terbuka.
  await page.goto("about:blank");
});

test("kartu membuka rincian lalu kembali ke peta", async ({ page }) => {
  // Mobile: kartu pertama di deret laci yang mengintip; desktop: kartu
  // pertama kelompok terbaru di rel kanan.
  const sumber = aliran(page)
    ? page.getByRole("region", { name: /laporan dan wilayah/i })
    : page.getByRole("region", { name: "Laporan terbaru" });
  await sumber.getByRole("button", { name: /buka rincian/i }).first().click();

  const dialog = page.getByRole("dialog", { name: /rincian laporan/i });
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/\/fire\//);

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/id\/?$/);

  // Lepas peta WebGL sebelum context ditutup — kalau tidak, teardown
  // menggantung menunggu request tile/Zarr yang masih terbuka.
  await page.goto("about:blank");
});
