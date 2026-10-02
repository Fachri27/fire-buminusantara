import { test } from "node:test";
import assert from "node:assert/strict";
import { orientasiKartu, bacaBerkasMedia } from "./media.ts";

/** Pemetaan pilihan orientasi peninjau → kolom events.orientation. */

test("potret dipetakan ke horizontal (foto memenuhi kartu)", () => {
  const media = [{ path: "fire/gambar/a.jpg", type: "image", orientasi: "potret" }];
  assert.equal(orientasiKartu(media), "horizontal");
});

test("lanskap dipetakan ke landscape (foto di bawah teks)", () => {
  const media = [{ path: "fire/gambar/a.jpg", type: "image", orientasi: "lanskap" }];
  assert.equal(orientasiKartu(media), "landscape");
});

test("pilihan pertama peninjau yang menang", () => {
  const media = [
    { path: "fire/gambar/a.jpg", type: "image", orientasi: "potret" },
    { path: "fire/gambar/b.jpg", type: "image", orientasi: "lanskap" },
  ];
  assert.equal(orientasiKartu(media), "horizontal");
});

test("lampiran tanpa pilihan orientasi jatuh ke landscape", () => {
  const media = [{ path: "fire/gambar/a.jpg", type: "image" }];
  assert.equal(orientasiKartu(media), "landscape");
});

test("media kosong, bukan larik, atau entri rusak tetap landscape", () => {
  assert.equal(orientasiKartu([]), "landscape");
  assert.equal(orientasiKartu(null), "landscape");
  assert.equal(orientasiKartu("bukan-larik"), "landscape");
  assert.equal(orientasiKartu([{ path: "" }]), "landscape");
});

test("bacaBerkasMedia mempertahankan data EXIF yang tersimpan di JSON DB", () => {
  const media = [
    {
      path: "fire/gambar/a.jpg",
      type: "image",
      exif: {
        lat: -3.584444,
        lng: 98.675833,
        waktu: "15 Agustus 2026 09.14",
      },
    },
  ];
  const terbaca = bacaBerkasMedia(media);
  assert.equal(terbaca.length, 1);
  assert.ok(terbaca[0].exif);
  assert.equal(terbaca[0].exif?.lat, -3.584444);
  assert.equal(terbaca[0].exif?.lng, 98.675833);
  assert.equal(terbaca[0].exif?.waktu, "15 Agustus 2026 09.14");
});

test("galeriTersimpan menyertakan path dan mempertahankan urutan media", async () => {
  const { galeriTersimpan } = await import("./media.ts");
  const media = [
    { path: "fire/video/vid1.mp4", type: "video", poster: "fire/poster/pos1.jpg", keterangan: "Video Lapangan" },
    { path: "fire/gambar/foto1.jpg", type: "image", keterangan: "Foto Bukti" },
  ];
  const terbaca = galeriTersimpan(media);
  assert.equal(terbaca.length, 2);
  assert.equal(terbaca[0].jenis, "video");
  assert.equal(terbaca[0].path, "fire/video/vid1.mp4");
  assert.equal(terbaca[0].url, "/media/video/vid1.mp4");
  assert.equal(terbaca[0].poster, "/media/poster/pos1.jpg");
  assert.equal(terbaca[0].keterangan, "Video Lapangan");

  assert.equal(terbaca[1].jenis, "gambar");
  assert.equal(terbaca[1].path, "fire/gambar/foto1.jpg");
  assert.equal(terbaca[1].url, "/media/gambar/foto1.jpg");
  assert.equal(terbaca[1].keterangan, "Foto Bukti");
});

test("itemMedia mempertahankan urutan media dari galeri jika sudah tersimpan", async () => {
  const { itemMedia } = await import("./media.ts");
  const media = [
    { path: "fire/video/pertama.mp4", type: "video", poster: "fire/poster/pertama.jpg" },
    { path: "fire/gambar/kedua.jpg", type: "image" },
  ];
  const item = itemMedia(media, "fire/gambar/kedua.jpg", "fire/video/pertama.mp4");
  assert.equal(item.length, 2);
  assert.equal(item[0].jenis, "video");
  assert.equal(item[0].url, "/media/video/pertama.mp4");
  assert.equal(item[1].jenis, "gambar");
  assert.equal(item[1].url, "/media/gambar/kedua.jpg");
});
