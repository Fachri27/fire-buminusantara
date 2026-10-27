import test from "node:test";
import assert from "node:assert/strict";

import type * as maplibregl from "maplibre-gl";

import { peringkatHotspot, setelDataHotspot, susunTitikTampil, type DataHotspot } from "./lapisan-hotspot.ts";

/** Satu titik per satelit (indeks s 0..2) — kolom = DataHotspot.titik. */
const data: DataHotspot = {
  hari: "2026-10-24",
  hariTersedia: ["2026-10-24"],
  diperbarui: null,
  diambil: "2026-10-24T00:00:00.000Z",
  satelit: [],
  lengkap: true,
  provinsi: ["Riau"],
  kabupaten: ["Siak"],
  titik: [0, 1, 2].map((s) => [101 + s, 0.5, 1, 10, 29878605, s, 0, 0, 0]),
};

const id = (baris: number[][]) => baris.map((t) => t[9]);

test("baris tampil hanya satelit yang menyala; id (kolom ke-10) = indeks titik, tetap saat sakelar lain diganti", () => {
  assert.deepEqual(id(susunTitikTampil(data, [true, true, true])), [0, 1, 2]);
  const sebagian = susunTitikTampil(data, [true, false, true]);
  assert.deepEqual(sebagian.map((t) => t[5]), [0, 2]);
  assert.deepEqual(id(sebagian), [0, 2]);
});

test("fitur peta membawa id baris tampil di properti id (promoteId sumber)", () => {
  let terkirim: GeoJSON.FeatureCollection | undefined;
  const peta = { getSource: () => ({ setData: (d: GeoJSON.FeatureCollection) => (terkirim = d) }), getLayer: () => undefined };
  const titik = susunTitikTampil(data, [false, true, true]);
  setelDataHotspot(peta as unknown as maplibregl.Map, { ...data, titik });
  assert.deepEqual(terkirim?.features.map((f) => f.properties?.id), id(titik));
});

test("pudar ganti hari yang tertunda dibatalkan saat peta dibuang", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const pendengar: Record<string, () => void> = {};
  const sentuhan: string[] = [];
  const peta = {
    getSource: () => ({ setData: () => sentuhan.push("setData") }),
    getLayer: () => ({}),
    setPaintProperty: () => {},
    once: (jenis: string, fn: () => void) => (pendengar[jenis] = fn),
  };
  setelDataHotspot(peta as unknown as maplibregl.Map, data, true);
  pendengar.remove?.();
  t.mock.timers.tick(1000);
  assert.deepEqual(sentuhan, []);
});

test("peringkat hanya menghitung S-NPP & NOAA-20, urut jumlah menurun", () => {
  // [s, kepercayaan, provinsi, kabupaten, malam]; MODIS (0) diabaikan.
  const titik = [
    [1, 2, 0, 0, 0], [2, 1, 0, 0, 1], [0, 2, 0, 0, 1],
    [1, 2, 1, 1, 0], [2, 2, 1, 1, 1], [2, 0, 1, -1, 1],
  ].map(([s, k, p, kab, malam]) => [100, 0, k, 1, 0, s, p, malam, kab]);
  const { provinsi, kabupaten } = peringkatHotspot({ ...data, provinsi: ["Riau", "Jambi"], kabupaten: ["Siak", "Muaro Jambi"], titik });
  assert.deepEqual(provinsi, [
    { nama: "Jambi", jumlah: 3, perSatelit: [1, 2], perKepercayaan: [1, 0, 2], malam: 2 },
    { nama: "Riau", jumlah: 2, perSatelit: [1, 1], perKepercayaan: [0, 1, 1], malam: 1 },
  ]);
  // Titik tanpa kabupaten (-1) tetap masuk provinsinya, tak masuk kabupaten mana pun.
  assert.deepEqual(kabupaten.map((b) => [b.nama, b.jumlah]), [["Muaro Jambi", 2], ["Siak", 2]]);
});
