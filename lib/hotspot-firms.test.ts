import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";

// Jangan pernah menulis Redis sungguhan (bisa jadi Redis produksi bila REDIS_URL
// diekspor di shell): redis.ts membaca env saat dimuat, jadi hapus sebelum impor.
delete process.env.REDIS_URL;
// Kunci API FIRMS dari shell tak boleh ikut: hanya uji API area yang menyetelnya.
delete process.env.FIRMS_MAP_KEY;
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
const { provinsiDariTitik } = await import("./provinsi-titik.ts");
const { kabupatenDariTitik } = await import("./kabupaten-titik.ts");

/** CSV FIRMS deteksi di daratan DKI Jakarta, satu per waktu; kolom = yang dibaca urai(). */
function csv(kepercayaan: string, ...waktu: Date[]) {
  const baris = waktu.map((w) => {
    const tanggal = w.toISOString().slice(0, 10);
    const jam = w.toISOString().slice(11, 16).replace(":", "");
    return `-6.2,106.8,${kepercayaan},12.3,${tanggal},${jam},D\n`;
  });
  return `latitude,longitude,confidence,frp,acq_date,acq_time,daynight\n${baris.join("")}`;
}

/** fetch tiruan: HEAD selalu jawab, unduhan memakai `isi` (teks = 200; `isi` yang melempar = fetch gagal). */
function tiruFetch(t: TestContext, isi: (url: string) => string | Response) {
  const fetchAsli = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = fetchAsli;
  });
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    if (init?.method === "HEAD") return new Response(null);
    const r = isi(String(url));
    return typeof r === "string" ? new Response(r) : r;
  }) as typeof fetch;
}

// Entropi rendah: tak dikira rahasia sungguhan oleh gitleaks.
const KUNCI_API = "rahasia".repeat(5);

/** CSV API area MODIS: urutan kolom lain dari berkas wilayah, plus `instrument`; jam tanpa nol depan. */
function csvApi(...deteksi: [lat: string, lng: string, waktu: Date][]) {
  const baris = deteksi.map(([lat, lng, w]) => {
    const jam = Number(w.toISOString().slice(11, 16).replace(":", ""));
    return `${lat},${lng},330.1,${w.toISOString().slice(0, 10)},${jam},T,MODIS,90,6.1NRT,20.5,D\n`;
  });
  return `latitude,longitude,brightness,acq_date,acq_time,satellite,instrument,confidence,version,frp,daynight\n${baris.join("")}`;
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
  assert.equal(data.hari, hariWib(Date.now())); // 24 jam terakhir, walau sejamLalu masih kemarin
  assert.ok(data.sejak);
  assert.deepEqual(data.titik.map((t) => t[5]), [0, 1, 2]); // satu titik per satelit
  assert.deepEqual(data.titik[0].slice(0, 5), [106.8, -6.2, 2, 12.3, sejamLalu.getTime() / 60000]);
  assert.equal(data.provinsi[data.titik[0][6]], "DKI Jakarta");
  // Dekat batas Pusat/Barat: poligon asli GeoServer = Jakarta Barat (versi 600 m dulu salah: Pusat).
  assert.equal(data.kabupaten[data.titik[0][8]], "Kota Adm. Jakarta Barat");

  gagalkan = "MODIS"; // server utama dan cadangan sama-sama gagal
  const kedua = await segarkanHotspot();
  assert.equal(kedua.lengkap, false);
  // Berkas lain sama persis: tak diurai ulang (baris titik yang sama), hanya
  // harinya yang diturunkan ulang — waktu periksa maju, salinan tak menjadi basi.
  assert.equal((await bacaHotspot())!.titik[0], data.titik[0]);
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
  t.mock.timers.enable({ apis: ["Date"], now: awalHariIni + 12 * 3600_000 }); // 12.00 WIB: keduanya > 24 jam lalu
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
  t.mock.timers.tick(10_000); // BATAS_JAWAB, jauh sebelum tenggat 240 dtk
  const indeks = await janji;
  assert.equal(keCadangan.length, 3);
  assert.equal(indeks.lengkap, true);
});

test("indeks Redis hanya ditulis bila semua harinya tertulis; hari yang kuncinya hilang diganti hari lain", async (t) => {
  const HARI = 24 * 3600_000;
  const awalHariIni = Date.parse(`${hariWib(Date.now())}T00:00:00+07:00`);
  const [lusa, kemarin] = [awalHariIni - 2 * HARI + 3600_000, awalHariIni - HARI + 3600_000].map((w) => new Date(w));
  const [hariLusa, hariKemarin] = [hariWib(lusa.getTime()), hariWib(kemarin.getTime())];
  t.mock.timers.enable({ apis: ["Date"], now: awalHariIni + 12 * 3600_000 }); // 12.00 WIB: tanpa hari ini
  tiruFetch(t, () => csv("high", lusa, kemarin));
  const isi = (redis.isi = new Map());
  t.after(() => {
    redis.isi = null;
    redis.gagal = "";
  });
  const KUNCI = "firms:hotspot:v5";

  redis.gagal = hariKemarin; // time-out menulis nilai multi-MB satu hari
  await segarkanHotspot();
  assert.ok(isi.has(`${KUNCI}:${hariLusa}`));
  assert.equal(isi.has(KUNCI), false);
  // Isi FIRMS sama ("tak berubah"): hari itu dicoba lagi, indeks tetap tak ditulis selama ia gagal.
  await segarkanHotspot();
  assert.equal(isi.has(KUNCI), false);
  redis.gagal = "";
  const ketiga = await segarkanHotspot();
  assert.equal(JSON.parse(isi.get(`${KUNCI}:${hariKemarin}`)!).diambil, ketiga.versi);
  assert.equal(JSON.parse(isi.get(KUNCI)!).versi, ketiga.versi);

  // Salinan modul lain (rute) yang belum memegang hari itu: kuncinya hilang → hari lain, bukan null.
  isi.delete(`${KUNCI}:${hariKemarin}`);
  const salinanLain = "./hotspot-firms.ts?rute";
  const rute = (await import(salinanLain)) as typeof import("./hotspot-firms.ts");
  assert.equal((await rute.bacaHotspot(hariKemarin))!.hari, hariLusa);
  assert.equal((await rute.bacaHotspot())!.hari, hariLusa);
});

test("titik pesisir yang meleset dari poligon provinsi (kasar) diberi provinsi kabupatennya; titik laut tetap terbuang", async (t) => {
  const pesisir = [-8.5, 140.39]; // pesisir Merauke: hanya poligon kabupaten yang mengenainya
  const laut = [-9.5, 140]; // Laut Arafura, di dalam kotak Nusantara
  assert.equal(provinsiDariTitik(pesisir[0], pesisir[1]), null);
  assert.equal(provinsiDariTitik(laut[0], laut[1]), null);
  assert.equal(kabupatenDariTitik(laut[0], laut[1]), null);

  const waktu = new Date(Math.floor(Date.now() / 60000) * 60000 - 3600_000);
  const [tanggal, jam] = [waktu.toISOString().slice(0, 10), waktu.toISOString().slice(11, 16).replace(":", "")];
  const baris = ([lat, lng]: number[]) => `${lat},${lng},high,5,${tanggal},${jam},D\n`;
  tiruFetch(t, () => `latitude,longitude,confidence,frp,acq_date,acq_time,daynight\n${baris(pesisir)}${baris(laut)}`);

  await segarkanHotspot();
  const data = (await bacaHotspot(hariWib(waktu.getTime())))!;
  assert.equal(data.titik.length, 3); // satu per satelit; titik laut terbuang
  for (const titik of data.titik) {
    assert.deepEqual(titik.slice(0, 2), [140.39, -8.5]);
    assert.equal(data.provinsi[titik[6]], "Papua");
    assert.equal(data.kabupaten[titik[8]], "Merauke");
  }
});

test("FIRMS_MAP_KEY: tanpa kunci tak ada permintaan API; dengan kunci baris MODIS API ditambahkan, duplikat dibuang", async (t) => {
  t.after(() => {
    delete process.env.FIRMS_MAP_KEY;
  });
  const waktu = new Date(Math.floor(Date.now() / 60000) * 60000 - 90 * 60_000);
  const keApi: string[] = [];
  tiruFetch(t, (u) => {
    if (!u.includes("/api/area/")) return csv(u.includes("MODIS") ? "85" : "high", waktu);
    keApi.push(u);
    // Pertama = deteksi berkas wilayah (angka ditulis lain), kedua = baru (Jakarta Pusat).
    return csvApi(["-6.20", "106.80", waktu], ["-6.17", "106.83", waktu]);
  });
  const modis = async () => (await bacaHotspot(hariWib(waktu.getTime())))!.titik.filter((t) => t[5] === 0);

  await segarkanHotspot();
  assert.deepEqual(keApi, []);
  assert.equal((await modis()).length, 1);

  process.env.FIRMS_MAP_KEY = KUNCI_API;
  assert.equal((await segarkanHotspot()).lengkap, true);
  assert.deepEqual(keApi, [`https://firms.modaps.eosdis.nasa.gov/api/area/csv/${KUNCI_API}/MODIS_NRT/94.5,-11.5,141.5,6.5/2`]);
  assert.deepEqual((await modis()).map((t) => t.slice(0, 5)), [
    [106.8, -6.2, 2, 12.3, waktu.getTime() / 60000],
    [106.83, -6.17, 2, 20.5, waktu.getTime() / 60000], // kolom API dipetakan ke kepala berkas wilayah
  ]);
});

test("API area gagal (galat, kunci salah, kuota, bukan CSV): MODIS berkas wilayah saja, tetap lengkap; kunci tak pernah bocor", async (t) => {
  process.env.FIRMS_MAP_KEY = KUNCI_API;
  const isiRedis = (redis.isi = new Map<string, string>());
  t.after(() => {
    delete process.env.FIRMS_MAP_KEY;
    redis.isi = null;
  });
  // Semua log ditangkap: kunci tak boleh muncul di sana, di galat, maupun di Redis.
  const log: string[] = [];
  for (const k of ["log", "info", "warn", "error"] as const) {
    t.mock.method(console, k, (...a: unknown[]) => void log.push(a.map(String).join(" ")));
  }
  const waktu = new Date(Math.floor(Date.now() / 60000) * 60000 - 45 * 60_000);
  // Galat tiruan sengaja membawa URL (seperti galat fetch sungguhan bisa).
  const putus = (u: string): never => {
    throw new Error(`fetch failed ${u}`);
  };
  let api: (u: string) => string | Response = putus;
  let wilayahPutus = false;
  tiruFetch(t, (u) => {
    if (u.includes("/api/area/")) return api(u);
    if (wilayahPutus) putus(u);
    return csv(u.includes("MODIS") ? "85" : "high", waktu);
  });

  for (const gagal of [
    putus,
    () => new Response("Invalid MAP_KEY.", { status: 400 }),
    () => "Exceeding allowed transaction limit.",
    () => "<!doctype html><title>Maintenance</title>",
  ]) {
    api = gagal;
    assert.equal((await segarkanHotspot()).lengkap, true);
    assert.equal((await bacaHotspot(hariWib(waktu.getTime())))!.titik.filter((t) => t[5] === 0).length, 1);
  }

  wilayahPutus = true;
  const galat = await segarkanHotspot().then(
    () => assert.fail("FIRMS putus seluruhnya harus gagal"),
    (e: Error) => e,
  );
  for (const teks of [galat.message, galat.stack ?? "", ...log, ...isiRedis.keys(), ...isiRedis.values()]) {
    assert.ok(!teks.includes(KUNCI_API), teks.slice(0, 200));
  }
});

test("hari ini = 24 jam terakhir, hari lain hari kalender; berkas tak berubah tetap menggeser jendela & ganti hari", async (t) => {
  const JAM = 3600_000;
  const kini = Date.parse(`${hariWib(Date.now())}T10:00:00+07:00`);
  t.mock.timers.enable({ apis: ["Date"], now: kini });
  const siangKemarin = new Date(kini - 25 * JAM); // 09.00 WIB H-1: di luar 24 jam
  const malamKemarin = new Date(kini - 14 * JAM); // 20.00 WIB H-1: di dalam
  const pagiIni = new Date(kini - 2 * JAM); // 08.00 WIB
  tiruFetch(t, () => csv("high", siangKemarin, malamKemarin, pagiIni));
  const waktu = (d: { titik: number[][] }) => new Set(d.titik.map((t) => t[4] * 60000));
  const [kemarin, hariIni, besok] = [-1, 0, 1].map((n) => hariWib(kini + n * 24 * JAM));

  assert.deepEqual((await segarkanHotspot()).hari, [kemarin, hariIni]);
  const ini = (await bacaHotspot())!;
  assert.equal(ini.hari, hariIni);
  assert.equal(ini.sejak, new Date(kini - 24 * JAM).toISOString());
  assert.deepEqual(waktu(ini), new Set([malamKemarin.getTime(), pagiIni.getTime()]));
  const lalu = (await bacaHotspot(kemarin))!;
  assert.equal(lalu.sejak, undefined);
  assert.deepEqual(waktu(lalu), new Set([siangKemarin.getTime(), malamKemarin.getTime()]));

  // 00.30 WIB besok, berkas sama: tak diurai ulang, tapi malamKemarin keluar jendela, hari
  // ini jadi hari kalender, dan besok tersedia walau belum ada deteksi sejak 00.00 WIB.
  t.mock.timers.setTime(kini + 14.5 * JAM);
  assert.deepEqual((await segarkanHotspot()).hari, [kemarin, hariIni, besok]);
  const baru = (await bacaHotspot())!;
  assert.equal(baru.hari, besok);
  assert.ok(baru.sejak);
  assert.deepEqual(waktu(baru), new Set([pagiIni.getTime()]));
  assert.equal(baru.titik[0], ini.titik.find((t) => t[4] * 60000 === pagiIni.getTime()));
  const kalender = (await bacaHotspot(hariIni))!;
  assert.equal(kalender.sejak, undefined);
  assert.deepEqual(waktu(kalender), new Set([pagiIni.getTime()]));
  assert.deepEqual(waktu((await bacaHotspot(kemarin))!), waktu(lalu));
});

/** CSV berformat kepala FIRMS berisi kolom `satellite` (indeks 7) — berkas
 *  nyata: kepala MODIS memakai `brightness`, VIIRS `bright_ti4`, keduanya
 *  `satellite` di indeks yang sama. Dibaca salinanCadangan lewat satelitCsv. */
function csvSatelit(satelit: string, kepercayaan: string, waktu: Date) {
  const tanggal = waktu.toISOString().slice(0, 10);
  const jam = waktu.toISOString().slice(11, 16).replace(":", "");
  const kepala = "latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,confidence,version,bright_ti5,frp,daynight";
  return `${kepala}\n-6.2,106.8,330.0,0.4,0.6,${tanggal},${jam},${satelit},${kepercayaan},2.0NRT,292.0,2.5,D\n`;
}

test("salinan warisan v2 dipilih menurut isinya, bukan demi indeks kunci — renumerasi satelit tak menghapus, tak mencampur", async (t) => {
  const modulWarisan = "./hotspot-firms.ts?warisan";
  const m = (await import(modulWarisan)) as typeof import("./hotspot-firms.ts");
  const isi = redis.isi = new Map<string, string>();
  t.after(() => {
    redis.isi = null;
    redis.gagal = "";
  });
  const waktu = new Date(Math.floor(Date.now() / 60000) * 60000 - 2 * 3600_000);
  // Kondisi produksi insiden 28 Okt: kode lama menulis [S-NPP di v2:0,
  // NOAA-20 di v2:1], kode baru mengharapkan salinan NOAA-20 di v2:2.
  isi.set("firms:csv:v2:0", csvSatelit("N", "n", waktu));
  isi.set("firms:csv:v2:1", csvSatelit("N20", "h", waktu));
  // Unduhan MODIS dan NOAA-20 gagal (kedua server), S-NPP berhasil.
  const fetchAsli = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = fetchAsli;
  });
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    if (init?.method === "HEAD") return new Response(null);
    const u = String(url);
    if (u.includes("MODIS") || u.includes("noaa-20")) throw new Error("time-out");
    return new Response(csvSatelit("N", "l", waktu));
  }) as typeof fetch;

  const indeks = await m.segarkanHotspot();
  const data = (await m.bacaHotspot(hariWib(waktu.getTime())))!;
  assert.equal(indeks.lengkap, false);
  const perSatelit = [0, 1, 2].map((s) => data.titik.filter((k) => k[5] === s).length);
  // MODIS (indeks 0, tak punya salinan warisan) nol — BUKAN titik S-NPP salah
  // takhta dari v2:0. NOAA-20 (indeks 2) hidup dari salinan warisan v2:1 yang
  // isinya "N20". S-NPP (indeks 1) dari unduhan langsungnya.
  assert.deepEqual(perSatelit, [0, 1, 1]);
  assert.equal(data.kabupaten[data.titik.find((k) => k[5] === 2)![8]], "Kota Adm. Jakarta Barat");

  // Salinan warisan yang dipakai disalin ke kunci versi sekarang (TTL baru); kode
  // yang sama TAK menulis kunci v2 lagi — isinya tetap warisan tak tersentuh.
  for (let i = 0; i < 5 && !isi.has("firms:csv:v3:2"); i++) await new Promise((r) => setImmediate(r));
  assert.ok(isi.get("firms:csv:v3:2")!.includes(",N20,"), isi.get("firms:csv:v3:2")!.slice(0, 200));
  assert.equal(isi.get("firms:csv:v2:1"), csvSatelit("N20", "h", waktu));
});

test("satelit gagal tanpa salinan: berkas lain tak berubah tetap membaca salinan Redis yang baru ada", async (t) => {
  const modulBaru = "./hotspot-firms.ts?tanpa-salinan";
  const m = (await import(modulBaru)) as typeof import("./hotspot-firms.ts");
  const isi = (redis.isi = new Map<string, string>());
  t.after(() => {
    redis.isi = null;
  });
  const waktu = new Date(Math.floor(Date.now() / 60000) * 60000 - 2 * 3600_000);
  // NOAA-20 time-out di setiap penyegaran (produksi 28 Okt), dua berkas lain sama persis.
  tiruFetch(t, (u) => {
    if (u.includes("noaa-20")) throw new Error("time-out");
    return csvSatelit(u.includes("MODIS") ? "T" : "N", "h", waktu);
  });
  const perSatelit = async () => {
    const data = (await m.bacaHotspot(hariWib(waktu.getTime())))!;
    return [0, 1, 2].map((s) => data.titik.filter((k) => k[5] === s).length);
  };

  await m.segarkanHotspot();
  assert.deepEqual(await perSatelit(), [1, 1, 0]);
  // Salinan muncul di Redis (mis. ditulis penyegaran salinan modul rute).
  isi.set("firms:csv:v3:2", csvSatelit("N20", "h", waktu));
  await m.segarkanHotspot();
  assert.deepEqual(await perSatelit(), [1, 1, 1]);
});
