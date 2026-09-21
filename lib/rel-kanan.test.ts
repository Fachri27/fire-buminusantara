import test from "node:test";
import assert from "node:assert/strict";
import { bagiRelKanan } from "./rel-kanan.ts";

type Entri = { id: number; event_date: Date };

const tgl = (iso: string) => new Date(iso);
// Masukan selalu terbaru-dulu seperti kueri (event_date desc, id desc).
const entri = (id: number, iso: string): Entri => ({ id, event_date: tgl(iso) });
const peta = (isi: [number, number][]) => new Map(isi);

test("5 terbaru diambil dari depan, 5 populer dari sisanya tanpa ganda", () => {
  const semua = [
    entri(12, "2026-09-12"), entri(11, "2026-09-11"), entri(10, "2026-09-10"),
    entri(9, "2026-09-09"), entri(8, "2026-09-08"), entri(7, "2026-09-07"),
    entri(6, "2026-09-06"), entri(5, "2026-09-05"), entri(4, "2026-09-04"),
    entri(3, "2026-09-03"), entri(2, "2026-09-02"), entri(1, "2026-09-01"),
  ];
  // Komentar terbanyak justru di laporan lama — populer tidak boleh
  // menariknya ke kelompok terbaru.
  const { terbaru, populer } = bagiRelKanan(semua, peta([[1, 99], [2, 50]]));

  assert.deepEqual(terbaru.map((b) => b.id), [12, 11, 10, 9, 8]);
  assert.deepEqual(populer.map((b) => b.id), [1, 2, 7, 6, 5]);
});

test("populer diurut komentar desc, seri tanggal lalu id", () => {
  const semua = [
    entri(10, "2026-09-10"), entri(9, "2026-09-09"), entri(8, "2026-09-08"),
    entri(7, "2026-09-07"), entri(6, "2026-09-06"), entri(5, "2026-09-05"),
    entri(4, "2026-09-04T12:00:00Z"), entri(3, "2026-09-04T12:00:00Z"),
  ];
  // 4 dan 3 seri tanggal + seri komentar (0) → id besar dulu.
  const { terbaru, populer } = bagiRelKanan(semua, peta([[6, 3], [5, 3]]), 2, 6);

  assert.deepEqual(terbaru.map((b) => b.id), [10, 9]);
  assert.deepEqual(populer.map((b) => b.id), [6, 5, 8, 7, 4, 3]);
});

test("data kurang dari 5+5 tidak ganda dan tidak error", () => {
  const semua = [entri(3, "2026-09-03"), entri(2, "2026-09-02"), entri(1, "2026-09-01")];
  const { terbaru, populer } = bagiRelKanan(semua, peta([]));

  assert.deepEqual(terbaru.map((b) => b.id), [3, 2, 1]);
  assert.deepEqual(populer, []);
});

test("daftar kosong menghasilkan dua kelompok kosong", () => {
  assert.deepEqual(bagiRelKanan([], peta([])), { terbaru: [], populer: [] });
});
