import { test } from "node:test";
import assert from "node:assert/strict";
import { susunGaleri } from "./simpan-kejadian.ts";
import type { BerkasMedia } from "./media.ts";

test("susunGaleri mengatur urutan berkas lama sesuai media_urutan", async () => {
  const lama: BerkasMedia[] = [
    { path: "fire/gambar/foto0.jpg", type: "image", keterangan: "Foto Awal 0" },
    { path: "fire/gambar/foto1.jpg", type: "image", keterangan: "Foto Awal 1" },
    { path: "fire/video/vid2.mp4", type: "video", poster: "fire/poster/vid2.jpg", keterangan: "Video 2" },
  ];

  const formData = new FormData();
  // Simpan semua berkas lama
  formData.append("keep_media", "0");
  formData.append("keep_media", "1");
  formData.append("keep_media", "2");

  // Ubah urutan: Video 2 dulu, lalu Foto 0, lalu Foto 1
  formData.append("media_urutan", "lama:2");
  formData.append("media_urutan", "lama:0");
  formData.append("media_urutan", "lama:1");

  formData.append("media_desc_0", "Foto 0 Baru");
  formData.append("media_desc_1", "Foto 1 Tetap");
  formData.append("media_desc_2", "Video 2 Utama");

  const hasil = await susunGaleri(formData, lama);
  assert.ok(!("galat" in hasil), "susunGaleri tidak boleh error");

  assert.equal(hasil.media.length, 3);
  // Item 0 adalah Video 2
  assert.equal(hasil.media[0].path, "fire/video/vid2.mp4");
  assert.equal(hasil.media[0].type, "video");
  assert.equal(hasil.media[0].keterangan, "Video 2 Utama");

  // Item 1 adalah Foto 0
  assert.equal(hasil.media[1].path, "fire/gambar/foto0.jpg");
  assert.equal(hasil.media[1].keterangan, "Foto 0 Baru");

  // Item 2 adalah Foto 1
  assert.equal(hasil.media[2].path, "fire/gambar/foto1.jpg");
  assert.equal(hasil.media[2].keterangan, "Foto 1 Tetap");

  // Tidak ada yang dihapus
  assert.equal(hasil.dihapus.length, 0);
});

test("susunGaleri membuang berkas lama yang tidak dicentang dan menaruh sisanya sesuai urutan", async () => {
  const lama: BerkasMedia[] = [
    { path: "fire/gambar/foto0.jpg", type: "image" },
    { path: "fire/gambar/foto1.jpg", type: "image" },
  ];

  const formData = new FormData();
  // Hanya pertahankan foto 1
  formData.append("keep_media", "1");
  formData.append("media_urutan", "lama:1");
  formData.append("media_desc_1", "Keterangan Baru");

  const hasil = await susunGaleri(formData, lama);
  assert.ok(!("galat" in hasil));

  assert.equal(hasil.media.length, 1);
  assert.equal(hasil.media[0].path, "fire/gambar/foto1.jpg");
  assert.equal(hasil.media[0].keterangan, "Keterangan Baru");

  // foto0 dicatat untuk dihapus
  assert.equal(hasil.dihapus.length, 1);
  assert.equal(hasil.dihapus[0].path, "fire/gambar/foto0.jpg");
});

test("susunGaleri fallback urutan jika media_urutan tidak disediakan", async () => {
  const lama: BerkasMedia[] = [
    { path: "fire/gambar/foto0.jpg", type: "image" },
    { path: "fire/gambar/foto1.jpg", type: "image" },
  ];

  const formData = new FormData();
  formData.append("keep_media", "0");
  formData.append("keep_media", "1");

  const hasil = await susunGaleri(formData, lama);
  assert.ok(!("galat" in hasil));

  assert.equal(hasil.media.length, 2);
  assert.equal(hasil.media[0].path, "fire/gambar/foto0.jpg");
  assert.equal(hasil.media[1].path, "fire/gambar/foto1.jpg");
});
