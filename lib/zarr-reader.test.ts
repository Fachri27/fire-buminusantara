import test from "node:test";
import assert from "node:assert/strict";
import {
  GalatHuluZarr,
  ZARR_GLOBAL_GRID,
  adaDiLinimasa,
  bacaParamFrame,
  getZarrFrame,
  getZarrMetadata,
  bersihkanCacheKedaluwarsa,
  kosongkanSemuaCache,
  getJumlahCacheFrame,
  MAX_FRAME_CACHE_ENTRIES,
  CLEANUP_INTERVAL_MS,
} from "./zarr-reader.ts";

test("ZARR_GLOBAL_GRID memiliki dimensi dan resolusi global yang benar", () => {
  assert.equal(ZARR_GLOBAL_GRID.rows, 451);
  assert.equal(ZARR_GLOBAL_GRID.cols, 900);
  assert.equal(ZARR_GLOBAL_GRID.totalPoints, 451 * 900);
  assert.equal(ZARR_GLOBAL_GRID.maxDensityAod, 2.0);
});

test("getZarrMetadata mengembalikan daftar timestep dan konfigurasi grid global yang valid", async () => {
  const metadata = await getZarrMetadata();
  assert.ok(metadata.timesteps.length > 0, "Timesteps tidak boleh kosong");
  assert.equal(metadata.grid.rows, 451);
  assert.equal(metadata.grid.cols, 900);
  assert.deepEqual(metadata.grid.bounds, [
    [-90.0, -180.0],
    [90.0, 180.0],
  ]);

  const firstStep = metadata.timesteps[0];
  assert.equal(firstStep.index, 0);
  assert.ok(firstStep.iso.includes("T"));
  assert.ok(firstStep.labelWib.includes("WIB"));
  assert.ok(firstStep.labelUtc.includes("UTC"));
});

test("pembersihan berkala cache bekerja dengan benar dan membatasi ukuran RAM", () => {
  assert.ok(MAX_FRAME_CACHE_ENTRIES > 0);
  assert.equal(CLEANUP_INTERVAL_MS, 15 * 60 * 1000);

  kosongkanSemuaCache();
  assert.equal(getJumlahCacheFrame(), 0);

  // Jalankan pembersihan saat kosong
  const terhapus = bersihkanCacheKedaluwarsa(Date.now());
  assert.equal(terhapus, 0);
});


test("bacaParamFrame hanya menerima bilangan bulat polos, step 0..120, timeInner 0|1", () => {
  const baca = (q: string) => bacaParamFrame(new URLSearchParams(q));
  assert.deepEqual(baca("timeChunk=116&step=72&timeInner=1"), { timeChunk: 116, step: 72, timeInner: 1 });
  assert.deepEqual(baca("timeChunk=0&step=0"), { timeChunk: 0, step: 0, timeInner: 0 }, "timeInner bawaan 0");
  assert.deepEqual(baca("timeChunk=1&step=120"), { timeChunk: 1, step: 120, timeInner: 0 });
  for (const q of [
    "step=0", // timeChunk hilang
    "timeChunk=1", // step hilang
    "timeChunk=1&step=121",
    "timeChunk=1&step=0&timeInner=2",
    "timeChunk=-1&step=0",
    "timeChunk=1.5&step=0",
    "timeChunk=12abc&step=0",
    "timeChunk=1234567&step=0",
    "timeChunk=1&step=0&timeInner=01",
  ]) {
    assert.equal(baca(q), null, q);
  }
});

test("tanpa CAMS_ZARR_TOKEN: metadata jatuh ke cadangan, frame galat 503, linimasa membatasi frame", async (t) => {
  const tokenAsli = process.env.CAMS_ZARR_TOKEN;
  delete process.env.CAMS_ZARR_TOKEN;
  t.after(() => {
    if (tokenAsli !== undefined) process.env.CAMS_ZARR_TOKEN = tokenAsli;
  });
  kosongkanSemuaCache();

  const { timesteps } = await getZarrMetadata();
  const m = timesteps[timesteps.length - 1];
  assert.equal(await adaDiLinimasa(m.timeChunk, m.step, m.timeInner), true);
  assert.equal(await adaDiLinimasa(999_999, m.step, m.timeInner), false, "timeChunk di luar linimasa");
  assert.equal(await adaDiLinimasa(m.timeChunk, m.step, m.timeInner === 0 ? 7 : 0), false, "timeInner di luar linimasa");

  await assert.rejects(getZarrFrame(m.timeChunk, m.step, m.timeInner), (e) => e instanceof GalatHuluZarr && e.status === 503);
});

test("paksa segar metadata: serentak = satu unduhan, diulang dalam semenit tak menembak ECMWF lagi", async (t) => {
  const tokenAsli = process.env.CAMS_ZARR_TOKEN;
  const fetchAsli = globalThis.fetch;
  process.env.CAMS_ZARR_TOKEN = "token-uji";
  let unduhMeta = 0;
  globalThis.fetch = (async (url: string | URL | Request) => {
    if (String(url).includes("/.zmetadata")) unduhMeta++;
    return new Response(null, { status: 503, statusText: "Service Unavailable" });
  }) as typeof fetch;
  t.after(() => {
    globalThis.fetch = fetchAsli;
    if (tokenAsli === undefined) delete process.env.CAMS_ZARR_TOKEN;
    else process.env.CAMS_ZARR_TOKEN = tokenAsli;
  });
  kosongkanSemuaCache();

  const [a, b] = await Promise.all([getZarrMetadata(true), getZarrMetadata(true)]);
  assert.equal(unduhMeta, 1, "dua paksa segar serentak berbagi satu unduhan");
  assert.ok(a.timesteps.length > 0 && b.timesteps.length > 0, "ECMWF gagal → metadata cadangan");

  await getZarrMetadata(true);
  await getZarrMetadata();
  assert.equal(unduhMeta, 1, "paksa segar berikutnya dalam 60 dtk memakai tembolok");
});
