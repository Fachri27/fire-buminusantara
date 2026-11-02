import { test } from "node:test";
import assert from "node:assert/strict";
import { bacaUbin, kunciCitra, urlHulu } from "./citra-satelit.ts";

test("bacaUbin menerima ubin di dalam kisi zoom-nya", () => {
  assert.deepEqual(bacaUbin("0", "0", "0"), { z: 0, y: 0, x: 0 });
  assert.deepEqual(bacaUbin("4", "7", "13"), { z: 4, y: 7, x: 13 });
  assert.deepEqual(bacaUbin("14", "16383", "16383"), { z: 14, y: 16383, x: 16383 });
});

test("bacaUbin menolak ubin di luar kisi, zoom terlalu dalam, dan bukan angka", () => {
  for (const [z, y, x] of [
    ["4", "16", "0"],
    ["4", "0", "16"],
    ["15", "0", "0"],
    ["-1", "0", "0"],
    ["4", "1.5", "0"],
    ["4", "0", "0.jpeg"],
    ["4", "0", "../x"],
    ["", "0", "0"],
    ["999999", "0", "0"],
  ]) {
    assert.equal(bacaUbin(z, y, x), null, `${z}/${y}/${x}`);
  }
});

test("URL hulu & kunci MinIO memakai urutan z/y/x EOX", () => {
  const u = { z: 4, y: 7, x: 13 };
  assert.equal(urlHulu(u), "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/4/7/13.jpeg");
  assert.equal(kunciCitra(u), "citra/s2cloudless-2024/4/7/13.jpeg");
});
