import { test } from "node:test";
import assert from "node:assert/strict";
import { ambilLinimasaCams, cariIndeksTerdekat } from "./cams-wms.ts";

test("ambilLinimasaCams menghasilkan tepat 15 langkah per 3 jam untuk loop 21.6 detik", () => {
  const patokan = new Date("2026-09-04T12:00:00Z");
  const linimasa = ambilLinimasaCams(patokan);

  assert.equal(linimasa.length, 15, "Harus menghasilkan tepat 15 langkah temporal");

  // Periksa selisih antar langkah konsisten 3 jam (10800000 ms)
  for (let i = 1; i < linimasa.length; i++) {
    const selisih = linimasa[i].waktu - linimasa[i - 1].waktu;
    assert.equal(selisih, 3 * 3600 * 1000, `Selisih antara langkah ${i-1} dan ${i} harus 3 jam`);
  }

  // Verifikasi durasi loop penuh: 15 langkah * 1.44 detik = 21.6 detik
  const durasiPerLangkah = 1.44;
  const durasiLoop = linimasa.length * durasiPerLangkah;
  assert.equal(Math.round(durasiLoop * 10) / 10, 21.6, "Loop harus persis 21.6 detik");
});

test("cariIndeksTerdekat memilih indeks dengan selisih waktu minimal", () => {
  const patokan = new Date("2026-09-04T12:00:00Z");
  const linimasa = ambilLinimasaCams(patokan);

  // Cari waktu pas pada langkah ke-8
  const waktuPas = new Date(linimasa[8].waktu);
  assert.equal(cariIndeksTerdekat(linimasa, waktuPas), 8);

  // Cari waktu 1 jam setelah langkah ke-8 (lebih dekat ke-8 daripada ke-9)
  const waktuSedikitLewat = new Date(linimasa[8].waktu + 3600 * 1000);
  assert.equal(cariIndeksTerdekat(linimasa, waktuSedikitLewat), 8);

  // Cari waktu 2 jam setelah langkah ke-8 (lebih dekat ke-9)
  const waktuDekatBerikutnya = new Date(linimasa[8].waktu + 2 * 3600 * 1000);
  assert.equal(cariIndeksTerdekat(linimasa, waktuDekatBerikutnya), 9);
});
