import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";

// Jangan pernah menulis Redis sungguhan (bisa jadi Redis produksi bila REDIS_URL
// diekspor di shell): redis.ts membaca env saat dimuat, jadi hapus sebelum impor.
delete process.env.REDIS_URL;
// Klien tiruan di globalThis.__redisKlien (dipakai redis.ts bila ada): seperti tanpa
// Redis sampai `redis.isi` disetel; kunci berakhiran `redis.gagal` gagal ditulis.
const redis = { isi: null as Map<string, string> | null, gagal: "" };
(globalThis as { __redisKlien?: unknown }).__redisKlien = {
  status: "ready",
  get: async (k: string) => redis.isi?.get(k) ?? null,
  set: async (k: string, v: string) => {
    if (!redis.isi || (redis.gagal && k.endsWith(redis.gagal))) throw new Error("time-out");
    redis.isi.set(k, v);
  },
};
const { bacaHotspot, segarkanHotspot } = await import("./hotspot-firms.ts");
const { hariWib } = await import("./lapisan-hotspot.ts");

/** CSV FIRMS deteksi di daratan DKI Jakarta, satu per waktu; kolom = yang dibaca urai(). */
function csv(kepercayaan: string, ...waktu: Date[]) {
  const baris = waktu.map((w) => {
    const tanggal = w.toISOString().slice(0, 10);
    const jam = w.toISOString().slice(11, 16).replace(":", "");
    return `-6.2,106.8,${kepercayaan},12.3,${tanggal},${jam},D\n`;
  });
  return `latitude,longitude,confidence,frp,acq_date,acq_time,daynight\n${baris.join("")}`;
}

/** fetch tiruan: HEAD selalu jawab, unduhan memakai `isi`. */
function tiruFetch(t: TestContext, isi: (url: string) => string) {
  const fetchAsli = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = fetchAsli;
  });
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) =>
    new Response(init?.method === "HEAD" ? null : isi(String(url)))) as typeof fetch;
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
  const data = (await bacaHotspot())!;
  assert.equal(data.hari, hariWib(sejamLalu.getTime()));
  assert.deepEqual(data.titik.map((t) => t[5]), [0, 1, 2]); // satu titik per satelit
  assert.deepEqual(data.titik[0].slice(0, 5), [106.8, -6.2, 2, 12.3, sejamLalu.getTime() / 60000]);
  assert.equal(data.provinsi[data.titik[0][6]], "DKI Jakarta");
  // Dekat batas Pusat/Barat: poligon asli GeoServer = Jakarta Barat (versi 600 m dulu salah: Pusat).
  assert.equal(data.kabupaten[data.titik[0][8]], "Kota Adm. Jakarta Barat");

  gagalkan = "MODIS"; // server utama dan cadangan sama-sama gagal
  const kedua = await segarkanHotspot();
  assert.equal(kedua.lengkap, false);
  // Berkas lain sama persis: tak diurai & ditulis ulang — versi tetap,
  // hanya waktu periksa yang maju (salinan tak menjadi basi).
  assert.equal(kedua.versi, pertama.versi);
  assert.ok(kedua.diambil >= pertama.diambil);
  assert.equal((await bacaHotspot())!.diambil, kedua.diambil);
  assert.equal((await bacaHotspot())!.lengkap, false);

  const sebelum = unduhan;
  assert.deepEqual((await bacaHotspot())!.titik.map((t) => t[5]), [0, 1, 2]); // MODIS tidak hilang
  assert.equal(unduhan, sebelum);

  // Deteksi sebelum awal riwayat 7 hari dibuang — juga dari CSV cadangan. Tanpa satu
  // titik pun penyegaran gagal dan salinan lama tetap dilayani.
  gagalkan = "";
  isi = () => csv("high", new Date(Date.now() - 9 * 24 * 3600_000));
  await assert.rejects(segarkanHotspot(), /tanpa titik/);
  assert.equal((await bacaHotspot())!.titik.length, 3);
  // Kiriman kosong yang sama lagi tetap gagal — tak lolos sebagai "tak berubah".
  await assert.rejects(segarkanHotspot(), /tanpa titik/);
});

test("titik dikelompokkan per hari WIB; sebelum awal riwayat dibuang; hari di luar data diganti terdekat", async (t) => {
  const HARI = 24 * 3600_000;
  const awalHariIni = Date.parse(`${hariWib(Date.now())}T00:00:00+07:00`);
  const tertua = new Date(awalHariIni - 6 * HARI - 30 * 60_000); // 23.30 WIB H-7: sebelum awal riwayat → dibuang
  const malamLusa = new Date(awalHariIni - HARI - 30 * 60_000); // 23.30 WIB H-2
  const diniKemarin = new Date(awalHariIni - HARI + 30 * 60_000); // 00.30 WIB H-1, tanggal UTC-nya H-2
  tiruFetch(t, () => csv("high", tertua, malamLusa, diniKemarin));

  const [lusa, kemarin] = [hariWib(malamLusa.getTime()), hariWib(diniKemarin.getTime())];
  assert.deepEqual((await segarkanHotspot()).hari, [lusa, kemarin]);
  assert.deepEqual((await bacaHotspot(lusa))!.titik.map((t) => t[4] * 60000), [0, 1, 2].map(() => malamLusa.getTime()));
  assert.equal((await bacaHotspot(kemarin))!.titik.length, 3);
  assert.deepEqual((await bacaHotspot(kemarin))!.hariTersedia, [lusa, kemarin]);
  assert.equal((await bacaHotspot(null))!.hari, kemarin);
  assert.equal((await bacaHotspot(hariWib(Date.now() + 2 * HARI)))!.hari, kemarin); // prakiraan
  assert.equal((await bacaHotspot("2000-01-01"))!.hari, lusa);
});

test("isi bukan CSV FIRMS (halaman galat berstatus 200) = gagal: CSV sah terakhirnya tetap dipakai", async (t) => {
  const tadi = new Date(Math.floor(Date.now() / 60000) * 60000 - 2 * 3600_000);
  const barusan = new Date(tadi.getTime() + 3600_000);
  let modis = csv("85", tadi);
  let viirs = csv("high", tadi);
  tiruFetch(t, (u) => (u.includes("MODIS") ? modis : viirs));
  await segarkanHotspot();

  modis = "<!doctype html><title>Maintenance</title>";
  viirs = csv("high", tadi, barusan); // berubah: jalur urai penuh, bukan "tak berubah"
  const indeks = await segarkanHotspot();
  assert.equal(indeks.lengkap, false);
  const data = (await bacaHotspot(hariWib(tadi.getTime())))!;
  assert.ok(data.titik.some((t) => t[5] === 0)); // MODIS dari CSV sah terakhir, tak hilang
  // Koordinat yang sama dengan penguraian lalu: wilayahnya dari tembolok, harus tetap benar.
  assert.equal(data.provinsi[data.titik[0][6]], "DKI Jakarta");
  assert.equal(data.kabupaten[data.titik[0][8]], "Kota Adm. Jakarta Barat");
});

test("server utama menggantung: server cadangan dicoba sebelum tenggat habis", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const fetchAsli = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = fetchAsli;
  });
  const waktu = new Date(Math.floor(Date.now() / 60000) * 60000 - 30 * 60_000);
  const keCadangan: string[] = [];
  let menggantung = 0;
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    if (init?.method === "HEAD") return new Response(null);
    const u = String(url);
    if (u.startsWith("https://firms2.")) {
      keCadangan.push(u);
      return new Response(csv("high", waktu));
    }
    // Menerima koneksi tapi tak pernah menjawab — hanya batal lewat signal.
    menggantung++;
    return new Promise<Response>((_, tolak) => init?.signal?.addEventListener("abort", () => tolak(new Error("batal"))));
  }) as typeof fetch;

  const janji = segarkanHotspot();
  while (menggantung < 3) await new Promise((r) => setImmediate(r));
  t.mock.timers.tick(10_000); // BATAS_JAWAB, jauh sebelum tenggat 40 dtk
  const indeks = await janji;
  assert.equal(keCadangan.length, 3);
  assert.equal(indeks.lengkap, true);
});

test("indeks Redis hanya ditulis bila semua harinya tertulis; hari yang kuncinya hilang diganti hari lain", async (t) => {
  const HARI = 24 * 3600_000;
  const awalHariIni = Date.parse(`${hariWib(Date.now())}T00:00:00+07:00`);
  const [lusa, kemarin] = [awalHariIni - 2 * HARI + 3600_000, awalHariIni - HARI + 3600_000].map((w) => new Date(w));
  const [hariLusa, hariKemarin] = [hariWib(lusa.getTime()), hariWib(kemarin.getTime())];
  tiruFetch(t, () => csv("high", lusa, kemarin));
  const isi = (redis.isi = new Map());
  t.after(() => {
    redis.isi = null;
    redis.gagal = "";
  });
  const KUNCI = "firms:hotspot:v5";

  redis.gagal = hariKemarin; // time-out menulis nilai multi-MB satu hari
  const pertama = await segarkanHotspot();
  assert.ok(isi.has(`${KUNCI}:${hariLusa}`));
  assert.equal(isi.has(KUNCI), false);
  // Isi FIRMS sama ("tak berubah"): hari itu dicoba lagi, indeks tetap tak ditulis selama ia gagal.
  await segarkanHotspot();
  assert.equal(isi.has(KUNCI), false);
  redis.gagal = "";
  const ketiga = await segarkanHotspot();
  assert.equal(ketiga.versi, pertama.versi);
  assert.equal(JSON.parse(isi.get(`${KUNCI}:${hariKemarin}`)!).diambil, ketiga.versi);
  assert.equal(JSON.parse(isi.get(KUNCI)!).versi, ketiga.versi);

  // Salinan modul lain (rute) yang belum memegang hari itu: kuncinya hilang → hari lain, bukan null.
  isi.delete(`${KUNCI}:${hariKemarin}`);
  const salinanLain = "./hotspot-firms.ts?rute";
  const rute = (await import(salinanLain)) as typeof import("./hotspot-firms.ts");
  assert.equal((await rute.bacaHotspot(hariKemarin))!.hari, hariLusa);
  assert.equal((await rute.bacaHotspot())!.hari, hariLusa);
});
