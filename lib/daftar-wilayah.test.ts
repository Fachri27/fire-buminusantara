import test from "node:test";
import assert from "node:assert/strict";
import { cariWilayah, kotaTerdekat, DAFTAR_WILAYAH } from "./daftar-wilayah.ts";

test("DAFTAR_WILAYAH memuat 548 entri Kemendagri / BMKG resmi", () => {
  assert.equal(DAFTAR_WILAYAH.length, 548);
  const provinsi = DAFTAR_WILAYAH.filter((w) => w.tipe === "provinsi");
  const kabkot = DAFTAR_WILAYAH.filter((w) => w.tipe === "kabupaten" || w.tipe === "kota");
  assert.equal(provinsi.length, 34);
  assert.equal(kabkot.length, 514);
});

test("cariWilayah menemukan kabupaten dengan ejaan bebas", () => {
  const hasilWonosobo = cariWilayah("wonosobo");
  assert.ok(hasilWonosobo.length >= 1);
  assert.equal(hasilWonosobo[0].nama, "Kabupaten Wonosobo");
  assert.equal(hasilWonosobo[0].provinsi, "Jawa Tengah");
  assert.equal(hasilWonosobo[0].adm4, "33.07.01.2001");

  const hasilBandung = cariWilayah("bandung");
  const namaBandung = hasilBandung.map((h) => h.nama);
  assert.ok(namaBandung.includes("Kota Bandung"));
  assert.ok(namaBandung.includes("Kabupaten Bandung"));

  const hasilSleman = cariWilayah("sleman");
  assert.equal(hasilSleman[0].nama, "Kabupaten Sleman");
  assert.equal(hasilSleman[0].provinsi, "DI Yogyakarta");
});

test("cariWilayah menangani prefix kab. atau kota", () => {
  const hasil = cariWilayah("kab wonosobo");
  assert.equal(hasil[0].nama, "Kabupaten Wonosobo");

  const hasilKota = cariWilayah("kota semarang");
  assert.equal(hasilKota[0].nama, "Kota Semarang");
});

test("kotaTerdekat memetakan koordinat GPS ke kota Kemendagri terdekat", () => {
  // Monas (-6.1754, 106.8272) -> Jakarta Pusat
  const monas = kotaTerdekat(-6.1754, 106.8272);
  assert.ok(monas !== null);
  assert.equal(monas.nama, "Kota Jakarta Pusat");
  assert.equal(monas.adm4, "31.73.01.1001");

  // Gedung Sate (-6.9025, 107.6186) -> Kota Bandung
  const bandung = kotaTerdekat(-6.9025, 107.6186);
  assert.ok(bandung !== null);
  assert.equal(bandung.nama, "Kota Bandung");
  assert.equal(bandung.adm4, "32.73.01.1001");

  // Malioboro (-7.7926, 110.3658) -> Kota Yogyakarta
  const yogya = kotaTerdekat(-7.7926, 110.3658);
  assert.ok(yogya !== null);
  assert.equal(yogya.nama, "Kota Yogyakarta");
  assert.equal(yogya.adm4, "34.71.01.1001");
});
