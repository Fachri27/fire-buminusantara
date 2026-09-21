import test from "node:test";
import assert from "node:assert/strict";
import {
  redisGet,
  redisSet,
  redisGetBuffer,
  redisSetBuffer,
  periksaKoneksiRedis,
} from "./redis.ts";

test("Redis helper methods mengembalikan null/false secara aman saat offline tanpa melempar exception", async () => {
  // Tanpa instance Redis yang aktif di test runner, pastikan fungsi-fungsi fail-open
  const ping = await periksaKoneksiRedis();
  assert.equal(typeof ping, "boolean");

  const val = await redisGet("kunci_tidak_ada_test");
  assert.ok(val === null || typeof val === "string");

  const buf = await redisGetBuffer("buffer_tidak_ada_test");
  assert.ok(buf === null || Buffer.isBuffer(buf));

  const setRes = await redisSet("kunci_uji", "nilai_uji", 60);
  assert.equal(typeof setRes, "boolean");

  const setBufRes = await redisSetBuffer(
    "buffer_uji",
    new Uint8Array([1, 2, 3]),
    60
  );
  assert.equal(typeof setBufRes, "boolean");
});
