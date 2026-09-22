import { test } from "node:test";
import assert from "node:assert/strict";
import { uraiDraf, drafBerisi, DRAF_KOSONG } from "./draf-lapor.ts";

test("uraiDraf: pulang-pergi lewat JSON", () => {
  const draf = {
    judul: "Asap tebal di kebun",
    deskripsi: "Terlihat sejak subuh",
    nama: "Sari",
    lat: "-2.5",
    lng: "113.9",
    anonim: true,
  };
  assert.deepEqual(uraiDraf(JSON.stringify(draf)), draf);
});

test("uraiDraf: masukan yang tak terbaca jadi draf kosong", () => {
  for (const buruk of [null, "", "{rusak", "[1,2]", '"teks"', "null", "7"]) {
    assert.deepEqual(uraiDraf(buruk), DRAF_KOSONG, `gagal untuk: ${JSON.stringify(buruk)}`);
  }
});

test("uraiDraf: kunci hilang dan tipe salah tidak menular ke isian", () => {
  const d = uraiDraf(JSON.stringify({ judul: 42, deskripsi: "ada", anonim: "ya" }));
  assert.equal(d.judul, "");
  assert.equal(d.deskripsi, "ada");
  assert.equal(d.nama, "");
  // Hanya boolean true yang dianggap anonim — "ya" bukan centang.
  assert.equal(d.anonim, false);
});

test("drafBerisi: kosong dibuang, satu isian pun cukup untuk disimpan", () => {
  assert.equal(drafBerisi(DRAF_KOSONG), false);
  assert.equal(drafBerisi({ ...DRAF_KOSONG, judul: "x" }), true);
  assert.equal(drafBerisi({ ...DRAF_KOSONG, anonim: true }), true);
  assert.equal(drafBerisi({ ...DRAF_KOSONG, lng: "113.9" }), true);
});
