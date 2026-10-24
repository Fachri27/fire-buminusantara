import test from "node:test";
import assert from "node:assert/strict";

import { GAYA_SIPONGI, GAYA_TITIK, susunTitikTampil, type DataHotspot } from "./lapisan-hotspot.ts";

/** Satu titik per satelit (indeks s 0..3) — kolom = DataHotspot.titik. */
const data: DataHotspot = {
  diperbarui: null,
  diambil: "2026-10-24T00:00:00.000Z",
  satelit: [],
  lengkap: true,
  provinsi: ["Riau"],
  titik: [0, 1, 2, 3].map((s) => [101 + s, 0.5, 1, 10, 29878605, s, 0, 0]),
};

const id = (baris: number[][]) => baris.map((t) => t[9]);

test("id baris tampil (kolom ke-10) unik walau satu titik tampil di dua lapisan", () => {
  const baris = susunTitikTampil(data, { titik: true, satelit: [true, true, true] });
  // VIIRS (s 1..3) di Titik Hotspot + MODIS/SNPP/NOAA20 (s 0..2) di SiPongi.
  assert.equal(baris.length, 6);
  assert.equal(new Set(id(baris)).size, baris.length);
  assert.deepEqual(
    baris.map((t) => [t[5], t[8]]),
    [[0, GAYA_SIPONGI], [1, GAYA_TITIK], [1, GAYA_SIPONGI], [2, GAYA_TITIK], [2, GAYA_SIPONGI], [3, GAYA_TITIK]],
  );
});

test("id baris tampil tetap saat sakelar lain diganti (promoteId sumber peta)", () => {
  const sipongi = susunTitikTampil(data, { titik: false, satelit: [true, true, true] });
  const semua = susunTitikTampil(data, { titik: true, satelit: [true, true, true] });
  const idSipongi = id(semua.filter((t) => t[8] === GAYA_SIPONGI));
  assert.deepEqual(id(sipongi), idSipongi);
});
