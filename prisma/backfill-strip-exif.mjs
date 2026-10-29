// Backfill pembersihan metadata: setiap berkas media yang dirujuk basis data
// (events.image_id/video/media, public_reports.media — path & poster) disalin
// apa adanya ke `asli/<uuid>.<ext>` (bila belum ada), lalu objek publiknya
// ditimpa versi TANPA EXIF/GPS/XMP — sama dengan yang kini dilakukan
// simpanBerkas() di lib/unggah.ts untuk unggahan baru. Tanpa ini foto lama
// tetap membocorkan GPS, jam, dan model ponsel pelapornya lewat /media.
//
// Aman dijalankan berulang: salinan asli yang sudah ada TIDAK ditimpa dan
// menjadi sumber pembersihan; objek publik yang sudah bersih dilewati.
//
//   node prisma/backfill-strip-exif.mjs           # DRY-RUN — hanya melihat
//   node prisma/backfill-strip-exif.mjs --apply   # benar-benar menulis
//
// Lingkungannya sama dengan backfill-poster.mjs: (1) ffmpeg untuk video,
// (2) DATABASE_URL, (3) MINIO_* yang menunjuk bucket yang sama — biasanya di
// dalam kontainer web. lib/ tidak ikut ke image standalone, jadi pembersih
// gambar di bawah adalah SALINAN dari lib/unggah.ts; lib/unggah.test.ts
// memastikan keduanya tetap menghasilkan byte yang sama.
//
// shortcut: hanya objek di MinIO; berkas cadangan lokal (media/, ditulis saat
// MinIO mati) dilaporkan sebagai "tak ada di MinIO" — bersihkan manual bila ada.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import os from "node:os";
import path from "node:path";

const AWALAN = "fire/";
const AWALAN_ASLI = "asli/";
/** Bentuk kunci yang dilayani route /media — sama dengan kunciMediaPublik(). */
const KUNCI_PUBLIK = /^(gambar|video|poster)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpe?g|png|webp|mp4|mov|webm)$/;
const MIME = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
  mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm",
};
const jalankan = promisify(execFile);

/* ── Pembersih gambar: SALINAN dari lib/unggah.ts — ubah keduanya ────────── */

export function bersihkanGambar(buf, mime) {
  try {
    if (mime === "image/jpeg") return bersihkanJpeg(buf);
    if (mime === "image/png") return bersihkanPng(buf);
    if (mime === "image/webp") return bersihkanWebp(buf);
  } catch {
    /* RangeError dari readUInt* di luar batas = struktur rusak */
  }
  return null;
}

function orientasiTiff(buf, t, akhir) {
  const le = buf[t] === 0x49;
  const u16 = (i) => (i + 2 > akhir ? 0 : le ? buf.readUInt16LE(i) : buf.readUInt16BE(i));
  const u32 = (i) => (i + 4 > akhir ? 0 : le ? buf.readUInt32LE(i) : buf.readUInt32BE(i));
  const ifd = t + u32(t + 4);
  for (let i = 0, n = u16(ifd); i < n; i++) {
    if (u16(ifd + 2 + i * 12) === 0x0112) return u16(ifd + 10 + i * 12);
  }
  return 0;
}

function app1Orientasi(n) {
  return Buffer.from([
    0xff, 0xe1, 0x00, 0x22, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00,
    0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08,
    0x00, 0x01, 0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, n, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
  ]);
}

function bersihkanJpeg(buf) {
  const keluar = [buf.subarray(0, 2)];
  let piksel = 0;
  let orientasiDitulis = false;
  let o = 2;
  while (o + 4 <= buf.length) {
    if (buf[o] !== 0xff) return null;
    const m = buf[o + 1];
    if (m === 0xff) { o++; continue; }
    if (m === 0xd9) break;
    const akhir = o + 2 + buf.readUInt16BE(o + 2);
    if (akhir > buf.length || akhir < o + 4) return null;

    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc && akhir >= o + 9) {
      piksel = buf.readUInt16BE(o + 5) * buf.readUInt16BE(o + 7);
    }
    if (m === 0xe1 && !orientasiDitulis && buf.toString("latin1", o + 4, o + 10) === "Exif\0\0") {
      const n = orientasiTiff(buf, o + 10, akhir);
      if (n >= 2 && n <= 8) {
        keluar.push(app1Orientasi(n));
        orientasiDitulis = true;
      }
    }
    const app = m >= 0xe0 && m <= 0xef;
    if (m !== 0xfe && (!app || m === 0xe0 || m === 0xee ||
      (m === 0xe2 && buf.toString("latin1", o + 4, o + 16) === "ICC_PROFILE\0"))) {
      keluar.push(buf.subarray(o, akhir));
    }
    o = akhir;

    if (m === 0xda) {
      let j = o;
      for (;;) {
        j = buf.indexOf(0xff, j);
        if (j < 0 || j + 1 >= buf.length) { j = buf.length; break; }
        const b = buf[j + 1];
        if (b !== 0 && (b < 0xd0 || b > 0xd7)) break;
        j += 2;
      }
      keluar.push(buf.subarray(o, j));
      o = j;
    }
  }
  if (!piksel) return null;
  keluar.push(Buffer.from([0xff, 0xd9]));
  return { isi: Buffer.concat(keluar), piksel };
}

const PNG_SIMPAN = new Set([
  "tRNS", "gAMA", "cHRM", "sRGB", "iCCP", "sBIT", "bKGD", "pHYs",
  "acTL", "fcTL", "fdAT", "cICP", "mDCv", "cLLI",
]);

function bersihkanPng(buf) {
  if (buf.toString("latin1", 12, 16) !== "IHDR") return null;
  const piksel = buf.readUInt32BE(16) * buf.readUInt32BE(20);
  const keluar = [buf.subarray(0, 8)];
  let o = 8;
  while (o + 12 <= buf.length) {
    const akhir = o + 12 + buf.readUInt32BE(o);
    if (akhir > buf.length) return null;
    const tipe = buf.toString("latin1", o + 4, o + 8);
    if (!(buf[o + 4] & 0x20) || PNG_SIMPAN.has(tipe)) keluar.push(buf.subarray(o, akhir));
    o = akhir;
    if (tipe === "IEND") return { isi: Buffer.concat(keluar), piksel };
  }
  return null;
}

const WEBP_SIMPAN = new Set(["VP8 ", "VP8L", "VP8X", "ALPH", "ANIM", "ANMF", "ICCP"]);

function bersihkanWebp(buf) {
  const batas = Math.min(buf.length, 8 + buf.readUInt32LE(4));
  const keluar = [buf.subarray(0, 12)];
  let piksel = 0;
  let o = 12;
  while (o + 8 <= batas) {
    const tipe = buf.toString("latin1", o, o + 4);
    const ukuran = buf.readUInt32LE(o + 4);
    const d = o + 8;
    if (d + ukuran > batas) return null;
    if (tipe === "VP8X" && ukuran >= 10) {
      piksel = (buf.readUIntLE(d + 4, 3) + 1) * (buf.readUIntLE(d + 7, 3) + 1);
    } else if (tipe === "VP8 " && ukuran >= 10 && !piksel) {
      piksel = (buf.readUInt16LE(d + 6) & 0x3fff) * (buf.readUInt16LE(d + 8) & 0x3fff);
    } else if (tipe === "VP8L" && ukuran >= 5 && !piksel) {
      const b = buf.readUInt32LE(d + 1);
      piksel = ((b & 0x3fff) + 1) * (((b >>> 14) & 0x3fff) + 1);
    }
    const akhir = Math.min(d + ukuran + (ukuran & 1), batas);
    if (WEBP_SIMPAN.has(tipe)) keluar.push(buf.subarray(o, akhir));
    o = akhir;
  }
  if (!piksel) return null;
  const isi = Buffer.concat(keluar);
  isi.writeUInt32LE(isi.length - 8, 4);
  if (isi.toString("latin1", 12, 16) === "VP8X") isi[20] &= ~0x0c;
  return { isi, piksel };
}

/* ── Video: remux tanpa metadata, argumen sama dengan simpanBerkas() ─────── */

async function bersihkanVideo(buf, ext) {
  const kerja = await mkdtemp(path.join(os.tmpdir(), "backfill-exif-"));
  const masukan = path.join(kerja, "asli");
  const keluaran = path.join(kerja, `publik.${ext}`);
  try {
    await writeFile(masukan, buf);
    await jalankan("ffmpeg", ["-nostdin", "-y", "-protocol_whitelist", "file",
      "-f", ext === "webm" ? "matroska" : "mov", "-i", masukan,
      "-map", "0:v", "-map", "0:a?", "-map_metadata", "-1", "-map_chapters", "-1", "-c", "copy", keluaran],
      { timeout: 120_000 });
    return await readFile(keluaran);
  } catch {
    return null;
  } finally {
    await rm(kerja, { recursive: true, force: true });
  }
}

/* ── Backfill ──────────────────────────────────────────────────────────── */

async function main() {
  const APPLY = process.argv.includes("--apply");
  // Diimpor di sini, bukan di puncak: lib/unggah.test.ts mengimpor berkas ini
  // untuk membandingkan pembersihnya, tanpa menyentuh DB/bucket. dotenv
  // opsional — tidak ikut ke image standalone (lihat backfill-poster.mjs).
  try {
    await import("dotenv/config");
  } catch {
    /* env sudah ada di process.env */
  }
  const { PrismaClient } = await import("@prisma/client");
  const { PrismaMariaDb } = await import("@prisma/adapter-mariadb");
  const { S3Client, GetObjectCommand, HeadObjectCommand, PutObjectCommand } = await import("@aws-sdk/client-s3");

  const url = new URL(process.env.DATABASE_URL);
  const prisma = new PrismaClient({
    adapter: new PrismaMariaDb({
      host: url.hostname,
      port: Number(url.port || 3306),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.replace(/^\//, ""),
      connectionLimit: 5,
    }),
  });

  // Sama dengan getConfig(): kredensial bawaan hanya untuk pengembangan.
  if (process.env.NODE_ENV === "production" && (!process.env.MINIO_ACCESS_KEY || !process.env.MINIO_SECRET_KEY)) {
    throw new Error("MINIO_ACCESS_KEY dan MINIO_SECRET_KEY wajib diisi di produksi.");
  }
  const bucket = process.env.MINIO_BUCKET || "fire";
  const s3 = new S3Client({
    endpoint: process.env.MINIO_ENDPOINT?.replace(/\/$/, "") || "http://localhost:9000",
    region: "us-east-1",
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.MINIO_ACCESS_KEY || "minioadmin",
      secretAccessKey: process.env.MINIO_SECRET_KEY || "minioadmin",
    },
  });
  const tidakAda = (e) => e?.$metadata?.httpStatusCode === 404;
  const ambil = async (Key) => {
    const obj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key }));
    return Buffer.from(await obj.Body.transformToByteArray());
  };
  const ada = (Key) => s3.send(new HeadObjectCommand({ Bucket: bucket, Key })).then(
    () => true,
    (e) => { if (tidakAda(e)) return false; throw e; },
  );
  const taruh = (Key, Body, ContentType) => s3.send(new PutObjectCommand({ Bucket: bucket, Key, Body, ContentType }));

  try {
    console.log(`Mode: ${APPLY ? "APPLY (menulis)" : "DRY-RUN (tak menulis)"} | bucket=${bucket}`);

    const kunci = new Set();
    const lainnya = new Set();
    const catat = (p) => {
      if (typeof p !== "string" || !p.startsWith(AWALAN)) return;
      const k = p.slice(AWALAN.length);
      (KUNCI_PUBLIK.test(k) ? kunci : lainnya).add(k);
    };
    const catatMedia = (media) => {
      for (const m of Array.isArray(media) ? media : []) { catat(m?.path); catat(m?.poster); }
    };
    for (const e of await prisma.events.findMany({ select: { image_id: true, video: true, media: true } })) {
      catat(e.image_id);
      catat(e.video);
      catatMedia(e.media);
    }
    for (const r of await prisma.public_reports.findMany({ select: { media: true } })) catatMedia(r.media);

    const n = { bersih: 0, dibersihkan: 0, asliDisalin: 0, hilang: 0, gagal: 0 };
    for (const k of kunci) {
      const ext = k.split(".").pop();
      const mime = MIME[ext];
      const kAsli = AWALAN_ASLI + path.posix.basename(k);
      try {
        let publik;
        try {
          publik = await ambil(k);
        } catch (e) {
          if (!tidakAda(e)) throw e;
          n.hilang++;
          console.log(`   ? tak ada di MinIO: ${k}`);
          continue;
        }
        // Salinan asli yang sudah ada = sumber kebenaran; kalau belum ada,
        // objek publik itulah aslinya (belum pernah dibersihkan).
        const punyaAsli = await ada(kAsli);
        const sumber = punyaAsli ? await ambil(kAsli) : publik;
        const bersih = mime.startsWith("image/")
          ? bersihkanGambar(sumber, mime)?.isi ?? null
          : await bersihkanVideo(sumber, ext);
        if (!bersih) {
          n.gagal++;
          console.log(`   ✗ tak bisa dibersihkan (rusak/ffmpeg gagal): ${k}`);
          continue;
        }
        if (bersih.equals(publik)) { n.bersih++; continue; }

        console.log(`   ${APPLY ? "✓" : "→"} ${k}${punyaAsli ? "" : ` (asli → ${kAsli})`} ${publik.length} → ${bersih.length} byte`);
        if (!punyaAsli) n.asliDisalin++;
        n.dibersihkan++;
        if (!APPLY) continue;
        // Asli dulu: kalau langkah berikutnya gagal, bukti tetap aman.
        if (!punyaAsli) await taruh(kAsli, publik, mime);
        await taruh(k, bersih, mime);
      } catch (e) {
        n.gagal++;
        console.log(`   ✗ error: ${k} — ${e?.message}`);
      }
    }

    for (const k of lainnya) console.log(`   ! bentuk kunci tak dilayani /media (dilewati): ${k}`);
    console.log(`\nSelesai. Berkas dirujuk: ${kunci.size} | sudah bersih: ${n.bersih} | ` +
      `${APPLY ? "dibersihkan" : "akan dibersihkan"}: ${n.dibersihkan} (asli disalin: ${n.asliDisalin}) | ` +
      `tak ada di MinIO: ${n.hilang} | gagal: ${n.gagal} | kunci lain: ${lainnya.size}` +
      (APPLY ? "" : " (dry-run — belum ada perubahan)"));
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
