import test from "node:test";
import assert from "node:assert/strict";

// Jangan pernah menulis Redis sungguhan (bisa jadi Redis produksi bila REDIS_URL
// diekspor di shell): redis.ts membaca env saat dimuat, jadi hapus sebelum impor.
delete process.env.REDIS_URL;
const { bacaHotspot, segarkanHotspot } = await import("./hotspot-firms.ts");

/** CSV FIRMS satu deteksi di daratan DKI Jakarta; kolom = yang dibaca urai(). */
function csv(kepercayaan: string, waktu: Date) {
  const tanggal = waktu.toISOString().slice(0, 10);
  const jam = waktu.toISOString().slice(11, 16).replace(":", "");
  return `latitude,longitude,confidence,frp,acq_date,acq_time,daynight\n-6.2,106.8,${kepercayaan},12.3,${tanggal},${jam},D\n`;
}

test("segarkan menulis salinan; satelit gagal memakai CSV terakhirnya; baca tak menyentuh FIRMS", async (t) => {
  const fetchAsli = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = fetchAsli;
  });
  const sejamLalu = new Date(Math.floor(Date.now() / 60000) * 60000 - 3600_000);
  let gagalkan = "";
  let isi = (u: string) => csv(u.includes("MODIS") ? "85" : "high", sejamLalu);
  let unduhan = 0;
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    if (init?.method === "HEAD") return new Response(null);
    const u = String(url);
    unduhan++;
    if (gagalkan && u.includes(gagalkan)) throw new Error("time-out");
    return new Response(isi(u));
  }) as typeof fetch;

  assert.equal(await bacaHotspot(), null); // belum pernah disegarkan, tanpa Redis

  const pertama = await segarkanHotspot();
  assert.equal(pertama.lengkap, true);
  assert.deepEqual(pertama.titik.map((t) => t[5]), [0, 1, 2, 3]); // satu titik per satelit
  assert.deepEqual(pertama.titik[0].slice(0, 5), [106.8, -6.2, 2, 12.3, sejamLalu.getTime() / 60000]);
  assert.equal(pertama.provinsi[pertama.titik[0][6]], "DKI Jakarta");

  gagalkan = "MODIS"; // server utama dan cadangan sama-sama gagal
  const kedua = await segarkanHotspot();
  assert.equal(kedua.lengkap, false);
  assert.deepEqual(kedua.titik.map((t) => t[5]), [0, 1, 2, 3]); // MODIS tidak hilang

  const sebelum = unduhan;
  assert.equal(await bacaHotspot(), kedua);
  assert.equal(unduhan, sebelum);

  // Deteksi lebih tua dari 48 jam dibuang — juga dari CSV cadangan.
  gagalkan = "";
  isi = () => csv("high", new Date(Date.now() - 49 * 3600_000));
  assert.deepEqual((await segarkanHotspot()).titik, []);
});
