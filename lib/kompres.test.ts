import { test } from "node:test";
import assert from "node:assert/strict";
import { brotliDecompressSync, gunzipSync } from "node:zlib";
import { jsonTermampat } from "./kompres.ts";

const DATA = { titik: Array.from({ length: 500 }, (_, i) => [118 + i / 100, -1, 1, 3.2, 29886539, 0, 5, 1, 13]) };

async function bacaIsi(r: Response) {
  return Buffer.from(await r.arrayBuffer());
}

test("jsonTermampat: br bila diterima, isinya sama setelah dibuka", async () => {
  const r = jsonTermampat(new Request("http://x/", { headers: { "accept-encoding": "gzip, deflate, br" } }), DATA, {
    headers: { "Cache-Control": "public, max-age=60" },
  });
  assert.equal(r.headers.get("content-encoding"), "br");
  assert.equal(r.headers.get("vary"), "Accept-Encoding");
  assert.equal(r.headers.get("cache-control"), "public, max-age=60");
  const isi = await bacaIsi(r);
  assert.equal(r.headers.get("content-length"), String(isi.byteLength));
  assert.deepEqual(JSON.parse(brotliDecompressSync(isi).toString()), DATA);
});

test("jsonTermampat: gzip bila hanya gzip, mentah bila tanpa Accept-Encoding", async () => {
  const gz = jsonTermampat(new Request("http://x/", { headers: { "accept-encoding": "gzip" } }), DATA);
  assert.equal(gz.headers.get("content-encoding"), "gzip");
  assert.deepEqual(JSON.parse(gunzipSync(await bacaIsi(gz)).toString()), DATA);

  const mentah = jsonTermampat(new Request("http://x/"), DATA, { status: 201 });
  assert.equal(mentah.status, 201);
  assert.equal(mentah.headers.get("content-encoding"), null);
  assert.deepEqual(JSON.parse((await bacaIsi(mentah)).toString()), DATA);
});
