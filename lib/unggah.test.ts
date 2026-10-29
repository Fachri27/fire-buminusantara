import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { crc32, deflateSync } from "node:zlib";
import exifr from "exifr";
import sharp from "sharp";
import {
  gpsDariBerkas, exifDariBerkas, bersihkanGambar, simpanBerkas, hapusBerkas,
  getConfig, getMinioClient,
} from "./unggah.ts";

/* MinIO tiruan untuk seluruh berkas uji: tak ada yang menyentuh bucket
 * sungguhan. Badan berupa stream (video) dibaca habis supaya bisa diperiksa. */
type PerintahS3 = { constructor: { name: string }; input: { Key: string; Body?: unknown } };
const kiriman: PerintahS3[] = [];
(getMinioClient() as unknown as { send: (c: PerintahS3) => Promise<unknown> }).send = async (c) => {
  const badan = c.input.Body as AsyncIterable<Buffer> | undefined;
  if (badan && !Buffer.isBuffer(badan) && Symbol.asyncIterator in badan) {
    const potong: Buffer[] = [];
    for await (const p of badan) potong.push(p);
    c.input.Body = Buffer.concat(potong);
  }
  kiriman.push(c);
  return {};
};
const isiKiriman = (kunci: string) => kiriman.find((c) => c.input.Key === kunci)?.input.Body as Buffer;

/** JPEG kosong (tanpa EXIF GPS) sebagai gambar dasar penguji. */
async function jpegPolos(): Promise<Buffer> {
  return sharp({
    create: { width: 8, height: 8, channels: 3, background: { r: 20, g: 180, b: 20 } },
  })
    .jpeg()
    .toBuffer();
}

/** JPEG + tag GPS EXIF (3°35'4"S, 98°40'33"E → lat -3.584444, lng 98.675833). */
async function jpegDenganGps(): Promise<Buffer> {
  return sharp({
    create: { width: 8, height: 8, channels: 3, background: { r: 20, g: 180, b: 20 } },
  })
    .withMetadata({
      exif: {
        IFD0: { Make: "Simontini", Model: "FireCam S1" },
        IFD2: { DateTimeOriginal: "2026:08:15 09:14:22", CreateDate: "2026:08:15 09:14:22" },
        IFD3: {
          GPSLatitudeRef: "S",
          GPSLatitude: "3/1 35/1 4/1",
          GPSLongitudeRef: "E",
          GPSLongitude: "98/1 40/1 33/1",
        },
      },
    })
    .jpeg()
    .toBuffer();
}

/** Bungkus Buffer sebagai File semampunya (hanya butuh arrayBuffer()). */
function buatFile(buf: Buffer): File {
  return {
    name: "uji.jpg",
    type: "image/jpeg",
    size: buf.length,
    arrayBuffer: async () =>
      buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  } as unknown as File;
}

/** Satu box MP4: `[u32 size][4cc type][payload]`. */
function box(tipe: string, payload: Buffer): Buffer {
  const hdr = Buffer.alloc(8);
  hdr.writeUInt32BE(payload.length + 8, 0);
  hdr.write(tipe, 4, "latin1");
  return Buffer.concat([hdr, payload]);
}

/** Box `data` (version/flags 4 + locale 4 + teks) seperti di seek video. */
function dataBox(teks: string): Buffer {
  const s = Buffer.from(teks, "latin1");
  const payload = Buffer.alloc(8 + s.length);
  s.copy(payload, 8);
  return box("data", payload);
}

/** MP4 tiruan: ftyp + moov › udta › meta › ilst yang memuat ISO6709. */
function mp4DenganGps(iso6709: string): Buffer {
  const meta = box(
    "meta",
    Buffer.concat([Buffer.alloc(4), box("ilst", box("mdta", dataBox(iso6709)))]),
  );
  const udta = box("udta", meta);
  const moov = box("moov", udta);
  return Buffer.concat([box("ftyp", Buffer.from("isom", "latin1")), moov]);
}

test("membaca GPS EXIF dari gambar", async () => {
  const gps = await gpsDariBerkas(buatFile(await jpegDenganGps()));
  assert.ok(gps, "harus mengembalikan koordinat");
  // 3°35'04"S → -3,584444; 98°40'33"E → 98,675833
  assert.ok(Math.abs(gps.lat - -3.584444) < 0.001, `lat ${gps.lat}`);
  assert.ok(Math.abs(gps.lng - 98.675833) < 0.001, `lng ${gps.lng}`);
});

test("mengembalikan null untuk gambar tanpa GPS EXIF", async () => {
  const gps = await gpsDariBerkas(buatFile(await jpegPolos()));
  assert.equal(gps, null);
});

test("mengembalikan null untuk isi yang bukan gambar, tanpa melempar", async () => {
  const bukanGambar = Buffer.from("ini bukan gambar");
  const gps = await gpsDariBerkas(buatFile(bukanGambar));
  assert.equal(gps, null);
});

test("membaca GPS dari video MP4 (ISO6709 QuickTime)", async () => {
  const mp4 = mp4DenganGps("+03.5844+098.6758+000.000/");
  const gps = await gpsDariBerkas(buatFile(mp4));
  assert.ok(gps, "harus mengembalikan koordinat");
  assert.ok(Math.abs(gps.lat - 3.5844) < 0.0001, `lat ${gps.lat}`);
  assert.ok(Math.abs(gps.lng - 98.6758) < 0.0001, `lng ${gps.lng}`);
});

test("membaca GPS belahan selatan/barat dari video MP4", async () => {
  const mp4 = mp4DenganGps("-06.2000-106.8167+025.000/");
  const gps = await gpsDariBerkas(buatFile(mp4));
  assert.ok(gps, "harus mengembalikan koordinat");
  assert.ok(Math.abs(gps.lat - -6.2) < 0.0001, `lat ${gps.lat}`);
  assert.ok(Math.abs(gps.lng - -106.8167) < 0.0001, `lng ${gps.lng}`);
});

test("mengembalikan null untuk video tanpa metadata GPS", async () => {
  const mp4 = box("udta", box("meta", Buffer.concat([Buffer.alloc(4), box("ilst", box("mdta", dataBox("hello"))) ])));
  const video = Buffer.concat([box("ftyp", Buffer.from("isom", "latin1")), box("moov", mp4)]);
  const gps = await gpsDariBerkas(buatFile(video));
  assert.equal(gps, null);
});

test("exifDariBerkas membaca koordinat dan waktu pengambilan", async () => {
  const file = buatFile(await jpegDenganGps());
  const exif = await exifDariBerkas(file);
  assert.ok(exif, "harus mengembalikan objek exif");
  assert.ok(exif.lat !== undefined && Math.abs(exif.lat - -3.584444) < 0.001);
  assert.ok(exif.lng !== undefined && Math.abs(exif.lng - 98.675833) < 0.001);
  assert.ok(exif.waktu && exif.waktu.includes("Agustus 2026"));
});

/* ── Pembersihan metadata ─────────────────────────────────────────────── */

const GPS_EXIF = {
  IFD0: { Make: "Simontini", Model: "FireCam S1" },
  IFD2: { DateTimeOriginal: "2026:08:15 09:14:22" },
  IFD3: { GPSLatitudeRef: "S", GPSLatitude: "3/1 35/1 4/1", GPSLongitudeRef: "E", GPSLongitude: "98/1 40/1 33/1" },
};

/** Gambar 8×6 ber-EXIF GPS + Orientation 6 (potret dari ponsel). */
const gambarBerExif = () =>
  sharp({ create: { width: 8, height: 6, channels: 3, background: { r: 200, g: 60, b: 20 } } })
    .withMetadata({ exif: GPS_EXIF, orientation: 6 });

/** Segmen JPEG mentah `FF <penanda> <panjang> <isi>`. */
function segmenJpeg(penanda: number, isi: string): Buffer {
  const data = Buffer.from(isi, "latin1");
  const hdr = Buffer.from([0xff, penanda, 0, 0]);
  hdr.writeUInt16BE(data.length + 2, 2);
  return Buffer.concat([hdr, data]);
}

/** Satu chunk PNG dengan CRC sah. */
function chunkPng(tipe: string, data: Buffer): Buffer {
  const panjang = Buffer.alloc(4);
  panjang.writeUInt32BE(data.length);
  const isi = Buffer.concat([Buffer.from(tipe, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(isi));
  return Buffer.concat([panjang, isi, crc]);
}

const TANDA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
function ihdr(lebar: number, tinggi: number): Buffer {
  const d = Buffer.alloc(13);
  d.writeUInt32BE(lebar, 0);
  d.writeUInt32BE(tinggi, 4);
  d[8] = 8; // 8 bit per kanal
  d[9] = 2; // RGB
  return chunkPng("IHDR", d);
}

const tipeChunkPng = (b: Buffer) => {
  const t: string[] = [];
  for (let o = 8; o + 12 <= b.length; o += 12 + b.readUInt32BE(o)) t.push(b.toString("latin1", o + 4, o + 8));
  return t;
};
const tipeChunkWebp = (b: Buffer) => {
  const t: string[] = [];
  for (let o = 12, n = 0; o + 8 <= b.length; o += 8 + n + (n & 1)) {
    n = b.readUInt32LE(o + 4);
    t.push(b.toString("latin1", o, o + 4));
  }
  return t;
};
const pikselSama = async (a: Buffer, b: Buffer) =>
  (await sharp(a).raw().toBuffer()).equals(await sharp(b).raw().toBuffer());

test("JPEG: Exif/XMP/IPTC/komentar/trailer dibuang, orientasi & data gambar utuh", async () => {
  const dasar = await gambarBerExif().jpeg().toBuffer();
  const asli = Buffer.concat([
    dasar.subarray(0, 2),
    segmenJpeg(0xe1, "http://ns.adobe.com/xap/1.0/\0<x:xmpmeta>rahasia-xmp</x:xmpmeta>"),
    segmenJpeg(0xed, "Photoshop 3.0\x008BIM rahasia-iptc"),
    segmenJpeg(0xfe, "rahasia-komentar"),
    dasar.subarray(2),
    Buffer.from("MotionPhoto_Data rahasia-trailer"),
  ]);
  assert.ok(await exifr.gps(asli), "prasyarat: fixture ber-GPS");

  const hasil = bersihkanGambar(asli, "image/jpeg");
  assert.ok(hasil);
  assert.equal(hasil.piksel, 8 * 6);
  assert.ok(!(await exifr.gps(hasil.isi).catch(() => null)), "GPS harus hilang");
  const sisa = await exifr.parse(hasil.isi, { translateValues: false });
  assert.deepEqual(sisa, { Orientation: 6 }, "hanya orientasi yang tersisa");
  for (const s of ["Simontini", "FireCam", "2026:08:15", "rahasia"]) {
    assert.ok(!hasil.isi.includes(s), `"${s}" masih ada`);
  }
  // Tanpa encode ulang: SOS…EOI hasil adalah potongan utuh dari berkas asli.
  assert.ok(asli.includes(hasil.isi.subarray(hasil.isi.indexOf(Buffer.from([0xff, 0xda])))));
  assert.ok(await pikselSama(asli, hasil.isi));
});

test("PNG: eXIf/tEXt/iTXt/zTXt/tIME dibuang, IDAT utuh", async () => {
  const baris = Buffer.concat([Buffer.from([0]), Buffer.alloc(4 * 3, 0x7f)]); // filter 0 + 4 piksel RGB
  const idat = chunkPng("IDAT", deflateSync(Buffer.concat([baris, baris, baris])));
  const asli = Buffer.concat([
    TANDA_PNG,
    ihdr(4, 3),
    chunkPng("gAMA", Buffer.from([0, 0, 0xb1, 0x8f])),
    chunkPng("eXIf", Buffer.from("MM\0*\0\0\0\x08rahasia-exif", "latin1")),
    chunkPng("tEXt", Buffer.from("Comment\0rahasia-teks", "latin1")),
    chunkPng("zTXt", Buffer.concat([Buffer.from("Comment\0\0", "latin1"), deflateSync("rahasia-z")])),
    chunkPng("iTXt", Buffer.from("XML:com.adobe.xmp\0\0\0\0\0rahasia-xmp", "latin1")),
    chunkPng("tIME", Buffer.from([0x07, 0xea, 8, 15, 9, 14, 22])),
    idat,
    chunkPng("IEND", Buffer.alloc(0)),
  ]);

  const hasil = bersihkanGambar(asli, "image/png");
  assert.ok(hasil);
  assert.equal(hasil.piksel, 4 * 3);
  assert.deepEqual(tipeChunkPng(hasil.isi), ["IHDR", "gAMA", "IDAT", "IEND"]);
  assert.ok(!hasil.isi.includes("rahasia"));
  assert.ok(hasil.isi.includes(idat));
  assert.ok(await pikselSama(asli, hasil.isi));
});

test("WebP: chunk EXIF/XMP dibuang, bendera VP8X & ukuran RIFF dibetulkan", async () => {
  let asli = await gambarBerExif().webp({ lossless: true }).toBuffer();
  // Tambah chunk "XMP " + benderanya, seperti keluaran aplikasi kamera.
  const xmp = Buffer.from("<x:xmpmeta>rahasia-xmp</x:xmpmeta>", "latin1");
  const kepala = Buffer.alloc(8);
  kepala.write("XMP ", 0, "latin1");
  kepala.writeUInt32LE(xmp.length, 4);
  asli = Buffer.concat([asli, kepala, xmp, Buffer.alloc(xmp.length & 1)]);
  asli.writeUInt32LE(asli.length - 8, 4);
  asli[20] |= 0x04;
  // exifr tak membaca WebP: prasyaratnya dicek dari chunk & teks EXIF-nya.
  assert.ok(tipeChunkWebp(asli).includes("EXIF") && asli.includes("FireCam"), "prasyarat: fixture ber-EXIF");

  const hasil = bersihkanGambar(asli, "image/webp");
  assert.ok(hasil);
  assert.equal(hasil.piksel, 8 * 6);
  const tipe = tipeChunkWebp(hasil.isi);
  assert.ok(!tipe.includes("EXIF") && !tipe.includes("XMP "), `chunk tersisa: ${tipe}`);
  assert.equal(hasil.isi[20] & 0x0c, 0, "bendera EXIF/XMP harus mati");
  assert.equal(hasil.isi.readUInt32LE(4), hasil.isi.length - 8);
  assert.ok(!hasil.isi.includes("rahasia") && !hasil.isi.includes("FireCam"));
  assert.ok(await pikselSama(asli, hasil.isi));
});

test("gambar di atas 50 megapiksel ditolak dari header, tanpa didekode", async () => {
  const png = Buffer.concat([TANDA_PNG, ihdr(10000, 10000), chunkPng("IEND", Buffer.alloc(0))]);

  const jpeg = await jpegPolos();
  const sof = jpeg.indexOf(Buffer.from([0xff, 0xc0]));
  jpeg.writeUInt16BE(9000, sof + 5);
  jpeg.writeUInt16BE(9000, sof + 7);

  const webp = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#000" } }).webp().toBuffer();
  assert.equal(webp.toString("latin1", 12, 16), "VP8 ", "prasyarat: WebP lossy sederhana");
  webp.writeUInt16LE(9000, 26);
  webp.writeUInt16LE(9000, 28);

  for (const [buf, mime] of [[png, "image/png"], [jpeg, "image/jpeg"], [webp, "image/webp"]] as const) {
    assert.ok(bersihkanGambar(buf, mime)!.piksel > 50_000_000, mime);
    kiriman.length = 0;
    assert.deepEqual(await simpanBerkas(new File([new Uint8Array(buf)], "besar")), { galat: "Resolusi gambar melebihi 50 megapiksel." });
    assert.equal(kiriman.length, 0, "tak ada yang terunggah");
  }

  // Struktur rusak juga ditolak, bukan diunggah apa adanya.
  const rusak = await simpanBerkas(new File([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x40, 0, 0])], "rusak.jpg"));
  assert.deepEqual(rusak, { galat: "Berkas gambar rusak atau tidak terbaca." });
});

test("simpanBerkas: asli ber-EXIF ke asli/, publik tanpa EXIF; hapusBerkas membuang keduanya", async () => {
  kiriman.length = 0;
  const asli = await gambarBerExif().jpeg().toBuffer();
  const hasil = await simpanBerkas(new File([asli], "foto.jpg"));
  assert.ok(!("galat" in hasil));
  const uuid = /^fire\/gambar\/([0-9a-f-]{36})\.jpg$/.exec(hasil.path)?.[1];
  assert.ok(uuid, hasil.path);

  assert.deepEqual(kiriman.map((c) => c.input.Key), [`asli/${uuid}.jpg`, `gambar/${uuid}.jpg`]);
  assert.ok(isiKiriman(`asli/${uuid}.jpg`).equals(asli), "asli harus byte demi byte");
  assert.ok(!(await exifr.gps(isiKiriman(`gambar/${uuid}.jpg`)).catch(() => null)));

  kiriman.length = 0;
  await hapusBerkas(hasil.path);
  assert.deepEqual(
    kiriman.map((c) => [c.constructor.name, c.input.Key]),
    [["DeleteObjectCommand", `gambar/${uuid}.jpg`], ["DeleteObjectCommand", `asli/${uuid}.jpg`]],
  );
});

const jalankan = promisify(execFile);
const adaFfmpeg = await jalankan("ffmpeg", ["-version"]).then(() => true, () => false);

test("simpanBerkas: video di-remux tanpa lokasi QuickTime, asli tetap ber-GPS", { skip: !adaFfmpeg && "ffmpeg tidak terpasang" }, async () => {
  const kerja = await mkdtemp(path.join(os.tmpdir(), "uji-video-"));
  try {
    const sumber = path.join(kerja, "in.mp4");
    await jalankan("ffmpeg", [
      "-nostdin", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc=duration=1:size=64x64:rate=10",
      "-metadata", "location=+03.5844+098.6758/",
      "-metadata", "com.apple.quicktime.location.ISO6709=+03.5844+098.6758+000.000/",
      "-metadata", "creation_time=2026-08-15T09:14:22Z",
      "-movflags", "use_metadata_tags", "-c:v", "mpeg4", sumber,
    ]);
    const asli = await readFile(sumber);
    assert.ok(asli.includes("+03.5844"), "prasyarat: fixture berlokasi");

    kiriman.length = 0;
    const hasil = await simpanBerkas(new File([asli], "v.mp4"));
    assert.ok(!("galat" in hasil), JSON.stringify(hasil));
    const uuid = /^fire\/video\/([0-9a-f-]{36})\.mp4$/.exec(hasil.path)?.[1];
    assert.ok(uuid, hasil.path);

    assert.ok(isiKiriman(`asli/${uuid}.mp4`).equals(asli));
    const publik = isiKiriman(`video/${uuid}.mp4`);
    for (const s of ["+03.5844", "ISO6709", "2026-08-15"]) assert.ok(!publik.includes(s), `"${s}" masih ada`);

    // Hasil remux tetap video yang sah.
    const keluaran = path.join(kerja, "publik.mp4");
    await import("node:fs/promises").then((fs) => fs.writeFile(keluaran, publik));
    const { stdout } = await jalankan("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type", "-of", "csv=p=0", keluaran]);
    assert.equal(stdout.trim(), "video");
  } finally {
    await rm(kerja, { recursive: true, force: true });
  }
});

test("box `data` raksasa di video dilewati, bukan dibangun jadi string", async () => {
  const mp4 = mp4DenganGps("+03.5844+098.6758+000.000/" + " ".repeat(300));
  assert.equal(await gpsDariBerkas(buatFile(mp4)), null);
});

test("getConfig gagal tertutup di produksi tanpa kredensial MinIO", () => {
  const env = process.env as Record<string, string | undefined>;
  const simpan = { NODE_ENV: env.NODE_ENV, a: env.MINIO_ACCESS_KEY, s: env.MINIO_SECRET_KEY };
  try {
    env.NODE_ENV = "production";
    delete env.MINIO_ACCESS_KEY;
    delete env.MINIO_SECRET_KEY;
    assert.throws(() => getConfig(), /wajib diisi/);
  } finally {
    env.NODE_ENV = simpan.NODE_ENV;
    if (simpan.a !== undefined) env.MINIO_ACCESS_KEY = simpan.a;
    if (simpan.s !== undefined) env.MINIO_SECRET_KEY = simpan.s;
    if (simpan.NODE_ENV === undefined) delete env.NODE_ENV;
  }
});

test("salinan pembersih di prisma/backfill-strip-exif.mjs sama persis dengan lib/unggah.ts", async () => {
  const skrip = await import("../prisma/backfill-strip-exif.mjs");
  const contoh: [Buffer, string][] = [
    [await gambarBerExif().jpeg().toBuffer(), "image/jpeg"],
    [await gambarBerExif().png().toBuffer(), "image/png"],
    [await gambarBerExif().webp().toBuffer(), "image/webp"],
    [await gambarBerExif().webp({ lossless: true }).toBuffer(), "image/webp"],
    [Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x40]), "image/jpeg"],
  ];
  for (const [buf, mime] of contoh) {
    assert.deepEqual(skrip.bersihkanGambar(buf, mime), bersihkanGambar(buf, mime), mime);
  }
});
