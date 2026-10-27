import test from "node:test";
import assert from "node:assert/strict";
import { provinsiDariTitik, peringatanLokasi } from "./provinsi-titik.ts";
import { pencariFitur } from "./geometri.ts";

test("provinsiDariTitik mengenali titik di dalam poligon", () => {
  assert.equal(provinsiDariTitik(-6.2, 106.8), "DKI Jakarta");
  assert.equal(provinsiDariTitik(-1.388094, 110.188716), "Kalimantan Barat");
});

test("provinsiDariTitik mengenali pulau di luar daratan terbesar provinsinya", () => {
  // Dulu terbuang: pra-saring memakai kotak daratan terbesar (PUSAT_WILAYAH),
  // ~5% hotspot VIIRS Okt 2026 hilang dari peta & peringkat.
  assert.equal(provinsiDariTitik(-8.25, 124.55), "Nusa Tenggara Timur"); // Alor
  assert.equal(provinsiDariTitik(-2.85, 107.9), "Kepulauan Bangka Belitung"); // Belitung
  assert.equal(provinsiDariTitik(-3.4, 126.6), "Maluku"); // Buru
});

test("provinsiDariTitik null di luar poligon dan koordinat tak sah", () => {
  // Celah perbatasan: tidak ditutup-tutupi, pemanggil yang memutuskan.
  assert.equal(provinsiDariTitik(1.388094, 110.188716), null);
  assert.equal(provinsiDariTitik(Number.NaN, 110), null);
  assert.equal(provinsiDariTitik(0, 200), null);
  assert.equal(provinsiDariTitik(null as unknown as number, 110), null);
});

test("pencariFitur melewati geometri rusak alih-alih melempar", () => {
  const persegi = [[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]];
  const cari = pencariFitur([
    { nama: "tanpa koordinat", geometri: { type: "Polygon", coordinates: null } }, // rusak saat dimuat
    { nama: "cincin rusak", geometri: { type: "Polygon", coordinates: [persegi, null] } }, // rusak saat dicari
    { nama: "persegi", geometri: { type: "Polygon", coordinates: [persegi] } },
  ]);
  assert.equal(cari(1, 1), "persegi");
  assert.equal(cari(3, 3), null);
});

test("peringatanLokasi diam bila tak ada koordinat atau tak ada yang janggal", () => {
  assert.equal(peringatanLokasi(null, null, "apa pun"), null);
  assert.equal(peringatanLokasi(-6.2, 106.8, "Laporan kebakaran"), null);
});

test("peringatanLokasi menangkap S tertinggal ketik (kasus #51)", () => {
  const pesan = peringatanLokasi(
    1.388094, 110.188716,
    "Kebakaran di Laman Satong, Matan Hilir Utara, Ketapang, Kalimantan Barat",
  );
  assert.ok(pesan !== null);
  assert.match(pesan, /S\/U/);
  assert.match(pesan, /Kalimantan Barat/);
});

test("peringatanLokasi menyebut mismatch provinsi", () => {
  const pesan = peringatanLokasi(-6.2, 106.8, "Kebakaran di Siding, Kalimantan Barat");
  assert.ok(pesan !== null);
  assert.match(pesan, /DKI Jakarta/);
  assert.match(pesan, /Kalimantan Barat/);
});
