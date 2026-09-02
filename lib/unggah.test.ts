import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import piexif from "piexifjs";
import { gpsDariBerkas } from "./unggah.ts";

/** Pembagi derajat → pasangan rational DMS, sesuai format EXIF. */
function R(n: number, d: number): [number, number] {
  return [Math.round(n * d), d];
}

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
  const polos = await jpegPolos();
  const exif = piexif.dump({
    "0th": {},
    Exif: {},
    GPS: {
      [piexif.GPSIFD.GPSVersionID]: [2, 3, 0, 0],
      [piexif.GPSIFD.GPSLatitudeRef]: "S",
      [piexif.GPSIFD.GPSLatitude]: [R(3, 1), R(35, 1), R(4, 10)],
      [piexif.GPSIFD.GPSLongitudeRef]: "E",
      [piexif.GPSIFD.GPSLongitude]: [R(98, 1), R(40, 1), R(33, 10)],
    },
    Interop: {},
    "1st": {},
  });
  return Buffer.from(piexif.insert(exif, polos.toString("binary")), "binary");
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
