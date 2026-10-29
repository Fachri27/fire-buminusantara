import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BATAS_SERENTAK, BATAS_TOTAL_BYTE, CADANGAN_MULTIPART, bergiliran, koordinat, tolakUkuran,
} from "./batas-laporan.ts";

test("koordinat: kosong berdua = tanpa lokasi", () => {
  assert.equal(koordinat("", " "), null);
});

test("koordinat: koma desimal papan ketik Indonesia diterima", () => {
  assert.deepEqual(koordinat("-1,2345", "113,5"), { lat: -1.2345, lng: 113.5 });
});

test("koordinat: setengah, di luar jangkauan, dan 0,0 ditolak", () => {
  assert.ok("galat" in (koordinat("-1.2", "") ?? {}));
  assert.ok("galat" in (koordinat("91", "100") ?? {}));
  assert.ok("galat" in (koordinat("1", "181") ?? {}));
  assert.ok("galat" in (koordinat("abc", "100") ?? {}));
  assert.ok("galat" in (koordinat("0", "0") ?? {}));
});

const kiriman = (kepala: Record<string, string> = {}) =>
  new Request("http://lokal/", { method: "POST", headers: kepala, body: "isi" });

test("tolakUkuran: tanpa Content-Length 411 bila diwajibkan, lewat atap 413", () => {
  const atap = BATAS_TOTAL_BYTE + CADANGAN_MULTIPART;
  assert.equal(tolakUkuran(new Request("http://lokal/", { method: "POST" }), true)?.status, 411);
  assert.equal(tolakUkuran(new Request("http://lokal/", { method: "POST" }), false), null);
  assert.equal(tolakUkuran(kiriman({ "content-length": String(atap + 1) }), false)?.status, 413);
  assert.equal(tolakUkuran(kiriman({ "content-length": String(atap) }), true), null);
});

test("bergiliran: lewat BATAS_SERENTAK dijawab 503, jatah kembali saat selesai atau gagal", async () => {
  let lepas = () => {};
  const tahan = new Promise<void>((r) => (lepas = r));
  const berjalan = Array.from({ length: BATAS_SERENTAK }, () =>
    bergiliran(kiriman(), async () => {
      await tahan;
      return new Response("ok");
    }),
  );
  let dijalankan = false;
  const penuh = await bergiliran(kiriman(), async () => {
    dijalankan = true;
    return new Response("ok");
  });
  assert.equal(penuh.status, 503);
  assert.equal(dijalankan, false);

  lepas();
  await Promise.all(berjalan);
  await assert.rejects(bergiliran(kiriman(), async () => {
    throw new Error("gagal");
  }));
  assert.equal((await bergiliran(kiriman(), async () => new Response("ok"))).status, 200);
});
