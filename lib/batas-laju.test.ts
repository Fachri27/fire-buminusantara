import { test } from "node:test";
import assert from "node:assert/strict";
import { emberIp, lewatBatas, lewatBatasIp, sudahLewat, sudahLewatIp } from "./batas-laju.ts";

test("lewatBatas: tanpa Redis, kiriman ke-(batas+1) ditolak per kunci", async () => {
  for (let i = 0; i < 3; i++) assert.equal(await lewatBatas("uji:a", 3, 60), false);
  assert.equal(await lewatBatas("uji:a", 3, 60), true);
  assert.equal(await lewatBatas("uji:b", 3, 60), false, "kunci lain punya jatah sendiri");
});

test("lewatBatas: jatah di-reset setelah jendela waktu kedaluwarsa", async () => {
  assert.equal(await lewatBatas("uji:exp", 1, 1), false);
  assert.equal(await lewatBatas("uji:exp", 1, 1), true);
  await new Promise((r) => setTimeout(r, 1100));
  assert.equal(await lewatBatas("uji:exp", 1, 1), false, "setelah jendela 1s lewat, jatah baru dibuka kembali");
});

test("sudahLewat: hanya membaca jatah, tidak memakainya", async () => {
  assert.equal(await sudahLewat("uji:baca", 2), false, "kunci baru belum memakai apa pun");
  for (let i = 0; i < 5; i++) await sudahLewat("uji:baca", 2);
  assert.equal(await lewatBatas("uji:baca", 2, 60), false, "membaca berulang tidak menghabiskan jatah");
  assert.equal(await sudahLewat("uji:baca", 2), false, "baru 1 dari 2 terpakai");
  assert.equal(await lewatBatas("uji:baca", 2, 60), false);
  assert.equal(await sudahLewat("uji:baca", 2), true, "2 dari 2 terpakai: pemakaian berikutnya pasti ditolak");
});

test("sudahLewat: jatah kembali terbuka setelah jendela kedaluwarsa", async () => {
  assert.equal(await lewatBatas("uji:baca-exp", 1, 1), false);
  assert.equal(await sudahLewat("uji:baca-exp", 1), true);
  await new Promise((r) => setTimeout(r, 1100));
  assert.equal(await sudahLewat("uji:baca-exp", 1), false);
});

test("emberIp: per IP apa adanya, IP tak terbaca → ember bersama 10× lebih longgar", () => {
  assert.deepEqual(emberIp("masuk-mobile", "203.0.113.7", 20), { kunci: "masuk-mobile:203.0.113.7", batas: 20 });
  assert.deepEqual(emberIp("masuk-mobile", null, 20), { kunci: "masuk-mobile:tanpa-ip", batas: 200 });
});

test("lewatBatasIp: tanpa IP tidak lolos, semua pengirim berbagi satu ember", async () => {
  for (let i = 0; i < 10; i++) assert.equal(await lewatBatasIp("uji-ip", null, 1, 60), false);
  assert.equal(await lewatBatasIp("uji-ip", null, 1, 60), true, "kiriman ke-11 tanpa IP ditolak (1 × 10)");
  assert.equal(await lewatBatasIp("uji-ip", "198.51.100.1", 1, 60), false, "IP terbaca tetap punya ember sendiri");
  assert.equal(await lewatBatasIp("uji-ip", "198.51.100.1", 1, 60), true);
});

test("sudahLewatIp: membaca ember yang sama dengan lewatBatasIp", async () => {
  assert.equal(await sudahLewatIp("uji-ip-baca", null, 1), false);
  for (let i = 0; i < 10; i++) await lewatBatasIp("uji-ip-baca", null, 1, 60);
  assert.equal(await sudahLewatIp("uji-ip-baca", null, 1), true);
  assert.equal(await sudahLewatIp("uji-ip-baca", "198.51.100.2", 1), false);
});

test("lewatBatasIp: peringatan ip-tak-terbaca hanya di produksi, paling sering sekali per jam", async (t) => {
  const galat = t.mock.method(console, "error", () => {});
  const lama = process.env.NODE_ENV;
  const env = process.env as Record<string, string | undefined>;
  t.after(() => {
    if (lama === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = lama;
  });

  env.NODE_ENV = "development";
  await lewatBatasIp("uji-peringatan", null, 100, 60);
  assert.equal(galat.mock.callCount(), 0, "pengembangan: diam");

  env.NODE_ENV = "production";
  for (let i = 0; i < 5; i++) await lewatBatasIp("uji-peringatan", null, 100, 60);
  await sudahLewatIp("uji-peringatan", null, 100);
  assert.equal(galat.mock.callCount(), 1, "produksi: satu peringatan untuk banyak permintaan");
  assert.equal(galat.mock.calls[0].arguments[0], "[ip-tak-terbaca]");

  await lewatBatasIp("uji-peringatan", "198.51.100.3", 100, 60);
  assert.equal(galat.mock.callCount(), 1, "IP terbaca tidak memicu peringatan");
});
