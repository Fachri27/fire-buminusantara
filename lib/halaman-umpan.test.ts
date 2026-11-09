import test from "node:test";
import assert from "node:assert/strict";
import type { Berita } from "./events.ts";
import { halamanUmpan, saringanDariUrl, SARINGAN_BAWAAN, UMPAN_AWAL } from "./halaman-umpan.ts";

// 40 laporan, terbaru dulu (urutan ambilUmpan): id 40 → 1, satu per hari mundur
// dari 9 Agustus 2026. Genap di Sumatra, ganjil di Kalimantan; komentar = id % 3.
const tanggalId = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const semua = Array.from({ length: 40 }, (_, i) => {
  const id = 40 - i;
  return {
    id,
    judul: id === 7 ? "Asap tebal di Riau" : `Laporan ${id}`,
    tanggal: tanggalId.format(new Date(Date.UTC(2026, 7, 9 - i))),
    pulau: id % 2 ? "Kalimantan" : "Sumatra",
    jumlahKomentar: id % 3,
  } as unknown as Berita;
});
const ids = (b: Berita[]) => b.map((x) => x.id);

test("halaman bawaan berurutan tanpa celah dan tanpa ganda", () => {
  const h1 = halamanUmpan(semua, SARINGAN_BAWAAN);
  const h2 = halamanUmpan(semua, SARINGAN_BAWAAN, h1.berikut!);
  const h3 = halamanUmpan(semua, SARINGAN_BAWAAN, h2.berikut!);
  assert.equal(h1.isi.length, UMPAN_AWAL);
  assert.equal(h3.berikut, null);
  assert.deepEqual([...ids(h1.isi), ...ids(h2.isi), ...ids(h3.isi)], ids(semua));
});

test("jangkar setelah: laporan dihapus/masuk di antara halaman tak terlewat atau ganda", () => {
  const h1 = halamanUmpan(semua, SARINGAN_BAWAAN);
  const terakhir = h1.isi.at(-1)!.id; // id 26 (posisi 14)
  // Laporan id 38 diturunkan dan satu laporan baru masuk paling atas sebelum halaman 2 diminta.
  const baru = { ...semua[0], id: 41 } as Berita;
  const kini = [baru, ...semua.filter((b) => b.id !== 38)];
  const h2 = halamanUmpan(kini, SARINGAN_BAWAAN, h1.berikut!, terakhir);
  assert.equal(h2.isi[0].id, terakhir - 1); // tepat sesudah jangkar, bukan bergeser
  // Jangkar hilang → cadangan posisi.
  const tanpaJangkar = kini.filter((b) => b.id !== terakhir);
  assert.equal(halamanUmpan(tanpaJangkar, SARINGAN_BAWAAN, 15, terakhir).isi[0].id, tanpaJangkar[15].id);
});

test("wilayah, kata, dan tanggal menyaring; jumlahWilayah dari kata + tanggal", () => {
  const h = halamanUmpan(semua, { ...SARINGAN_BAWAAN, wilayah: "Sumatra" });
  assert.ok(h.isi.every((b) => b.pulau === "Sumatra"));
  assert.deepEqual(h.jumlahWilayah.semua, 40);
  assert.deepEqual([h.jumlahWilayah.Sumatra, h.jumlahWilayah.Kalimantan], [20, 20]);

  assert.deepEqual(ids(halamanUmpan(semua, { ...SARINGAN_BAWAAN, kata: "  RIAU " }).isi), [7]);

  // 9 Agustus = id 40 … 5 Agustus = id 36
  const t = halamanUmpan(semua, { ...SARINGAN_BAWAAN, dari: "2026-08-05", sampai: "2026-08-09" });
  assert.deepEqual(ids(t.isi), [40, 39, 38, 37, 36]);
  assert.equal(t.jumlahWilayah.semua, 5);
});

test("urut komentar: terbanyak dulu, seri tetap terbaru dulu", () => {
  const h = halamanUmpan(semua, { ...SARINGAN_BAWAAN, urut: "komentar" });
  assert.deepEqual(ids(h.isi).slice(0, 3), [38, 35, 32]);
});

test("query string asing jatuh ke bawaan", () => {
  const s = saringanDariUrl(new URLSearchParams("kursor=-5&wilayah=Mars&urut=x&dari=kemarin&cari=" + "a".repeat(500)));
  assert.deepEqual({ ...s, kata: s.kata.length }, { ...SARINGAN_BAWAAN, kata: 100, kursor: 0, setelah: null });
  assert.equal(saringanDariUrl(new URLSearchParams("setelah=abc")).setelah, null);
  assert.equal(saringanDariUrl(new URLSearchParams("setelah=27")).setelah, 27);
  assert.equal(saringanDariUrl(new URLSearchParams("kursor=30&wilayah=Jawa&urut=komentar")).kursor, 30);
});
