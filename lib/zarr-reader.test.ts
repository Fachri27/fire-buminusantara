import test from "node:test";
import assert from "node:assert/strict";
import {
  ZARR_GLOBAL_GRID,
  getZarrMetadata,
  bersihkanCacheKedaluwarsa,
  kosongkanSemuaCache,
  getJumlahCacheFrame,
  MAX_FRAME_CACHE_ENTRIES,
  CLEANUP_INTERVAL_MS,
} from "./zarr-reader.ts";

test("ZARR_GLOBAL_GRID memiliki dimensi dan resolusi global yang benar", () => {
  assert.equal(ZARR_GLOBAL_GRID.rows, 451);
  assert.equal(ZARR_GLOBAL_GRID.cols, 900);
  assert.equal(ZARR_GLOBAL_GRID.totalPoints, 451 * 900);
  assert.equal(ZARR_GLOBAL_GRID.maxDensityAod, 2.0);
});

test("getZarrMetadata mengembalikan daftar timestep dan konfigurasi grid global yang valid", async () => {
  const metadata = await getZarrMetadata();
  assert.ok(metadata.timesteps.length > 0, "Timesteps tidak boleh kosong");
  assert.equal(metadata.grid.rows, 451);
  assert.equal(metadata.grid.cols, 900);
  assert.deepEqual(metadata.grid.bounds, [
    [-90.0, -180.0],
    [90.0, 180.0],
  ]);

  const firstStep = metadata.timesteps[0];
  assert.equal(firstStep.index, 0);
  assert.ok(firstStep.iso.includes("T"));
  assert.ok(firstStep.labelWib.includes("WIB"));
  assert.ok(firstStep.labelUtc.includes("UTC"));
});

test("pembersihan berkala cache bekerja dengan benar dan membatasi ukuran RAM", () => {
  assert.ok(MAX_FRAME_CACHE_ENTRIES > 0);
  assert.equal(CLEANUP_INTERVAL_MS, 15 * 60 * 1000);

  kosongkanSemuaCache();
  assert.equal(getJumlahCacheFrame(), 0);

  // Jalankan pembersihan saat kosong
  const terhapus = bersihkanCacheKedaluwarsa(Date.now());
  assert.equal(terhapus, 0);
});

