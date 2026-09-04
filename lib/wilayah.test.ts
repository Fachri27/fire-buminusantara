import test from "node:test";
import assert from "node:assert/strict";
import {
  rapikanLokasi, inferProvinsi, inferPulau,
  ringkasNamaProvinsi, namaProvinsiLokal,
} from "./wilayah.ts";

test("rapikanLokasi membuka kurung dan membuang kode pos", () => {
  assert.equal(
    rapikanLokasi("[Siding][Siding][Bengkayang][West Kalimantan][Kalimantan][Indonesia][38425]"),
    "Siding, Siding, Bengkayang, West Kalimantan, Kalimantan, Indonesia",
  );
});

test("rapikanLokasi melewatkan teks bebas dan null", () => {
  assert.equal(rapikanLokasi("sekitar Siding, Bengkayang"), "sekitar Siding, Bengkayang");
  assert.equal(rapikanLokasi(null), null);
  assert.equal(rapikanLokasi("   "), null);
});

test("inferProvinsi mengenali label EN hasil reverse-geocode", () => {
  assert.equal(
    inferProvinsi("[Lamon Satong][North Matan Hilir][Ketapang][West Kalimantan][Kalimantan][Indonesia][38928]"),
    "Kalimantan Barat",
  );
  assert.equal(inferProvinsi("sekitar Siding, Bengkayang, West Kalimantan"), "Kalimantan Barat");
  assert.equal(inferProvinsi("1.488590, 110.452240"), null);
  assert.equal(inferProvinsi(null), null);
});

test("inferPulau mengikuti provinsi", () => {
  assert.equal(inferPulau("sekitar Siding, Bengkayang, West Kalimantan"), "Kalimantan");
  assert.equal(inferPulau(null), null);
});

test("ringkasNamaProvinsi menyeragamkan ejaan luar", () => {
  assert.equal(ringkasNamaProvinsi("Sumatra Utara"), "sumaterautara");
  assert.equal(ringkasNamaProvinsi("KEP. RIAU"), "kepulauanriau");
});

test("namaProvinsiLokal meloloskan yang tak dikenal apa adanya", () => {
  // Hanya varian ejaan lokal yang dipetakan; nama Inggris bukan urusannya
  // (pencocokan EN ditangani PROVINSI_PETA di inferProvinsi).
  assert.equal(namaProvinsiLokal("Kalimantan Barat"), "Kalimantan Barat");
  assert.equal(namaProvinsiLokal("Atlantis"), "Atlantis");
});
