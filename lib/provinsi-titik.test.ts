import test from "node:test";
import assert from "node:assert/strict";
import { provinsiDariTitik, peringatanLokasi } from "./provinsi-titik.ts";

test("provinsiDariTitik mengenali titik di dalam poligon", () => {
  assert.equal(provinsiDariTitik(-6.2, 106.8), "DKI Jakarta");
  assert.equal(provinsiDariTitik(-1.388094, 110.188716), "Kalimantan Barat");
});

test("provinsiDariTitik null di luar poligon dan koordinat tak sah", () => {
  // Celah perbatasan: tidak ditutup-tutupi, pemanggil yang memutuskan.
  assert.equal(provinsiDariTitik(1.388094, 110.188716), null);
  assert.equal(provinsiDariTitik(Number.NaN, 110), null);
  assert.equal(provinsiDariTitik(0, 200), null);
  assert.equal(provinsiDariTitik(null as unknown as number, 110), null);
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
