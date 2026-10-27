import test from "node:test";
import assert from "node:assert/strict";
import { nomorHalaman } from "./halaman.ts";

test("nomorHalaman: semua bila sedikit, elipsis bila banyak, celah satu halaman diisi", () => {
  assert.deepEqual(nomorHalaman(0, 1), [0]);
  assert.deepEqual(nomorHalaman(0, 2), [0, 1]);
  assert.deepEqual(nomorHalaman(2, 5), [0, 1, 2, 3, 4]);
  assert.deepEqual(nomorHalaman(0, 30), [0, 1, null, 29]);
  assert.deepEqual(nomorHalaman(5, 30), [0, null, 4, 5, 6, null, 29]);
  assert.deepEqual(nomorHalaman(29, 30), [0, null, 28, 29]);
  assert.deepEqual(nomorHalaman(2, 30), [0, 1, 2, 3, null, 29]);
});
