// Backfill poster video: membuat bingkai poster untuk setiap VIDEO lama yang
// belum punya poster di kolom `events.media`. Tanpa poster, pratinjau bagikan
// (og:image) video-saja tampil tanpa gambar.
//
// Aman dijalankan berulang: video yang sudah punya poster dilewati.
//
//   node prisma/backfill-poster.mjs           # DRY-RUN — hanya melihat
//   node prisma/backfill-poster.mjs --apply   # benar-benar membuat & menyimpan
//
// Jalankan di lingkungan yang: (1) punya ffmpeg, (2) DATABASE_URL menunjuk DB
// yang benar, (3) kredensial MinIO (MINIO_*) menunjuk bucket yang sama. Di
// produksi Docker, jalankan di dalam host/kontainer yang memenuhi ketiganya.
// dotenv opsional: di pengembangan ia memuat .env; di kontainer produksi env
// sudah tersedia (env_file di compose) dan paket dotenv tidak ikut ter-bundle
// ke image standalone — jadi ketiadaannya tidak boleh menggagalkan skrip.
try {
  await import("dotenv/config");
} catch {
  /* env sudah ada di process.env */
}
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { mkdtemp, writeFile, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const APPLY = process.argv.includes("--apply");
const AWALAN = "fire/";
const jalankan = promisify(execFile);

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

const cfg = {
  endpoint: process.env.MINIO_ENDPOINT?.replace(/\/$/, "") || "http://localhost:9000",
  accessKey: process.env.MINIO_ACCESS_KEY || "minioadmin",
  secretKey: process.env.MINIO_SECRET_KEY || "minioadmin",
  bucket: process.env.MINIO_BUCKET || "fire",
};
const s3 = new S3Client({
  endpoint: cfg.endpoint,
  region: "us-east-1",
  forcePathStyle: true,
  credentials: { accessKeyId: cfg.accessKey, secretAccessKey: cfg.secretKey },
});

/** Bingkai pertama video → simpan sebagai poster JPEG di fire/poster/. Meniru
 *  bingkaiVideo() di lib/unggah.ts. Mengembalikan path `fire/poster/…` atau null. */
async function buatPoster(pathVideo) {
  if (!pathVideo.startsWith(AWALAN)) return null;
  const relatif = pathVideo.slice(AWALAN.length);
  const kerja = await mkdtemp(path.join(os.tmpdir(), "backfill-"));
  const masukan = path.join(kerja, "in");
  const keluaran = path.join(kerja, "out.jpg");
  try {
    const obj = await s3.send(new GetObjectCommand({ Bucket: cfg.bucket, Key: relatif }));
    if (!obj.Body) return null;
    await writeFile(masukan, Buffer.from(await obj.Body.transformToByteArray()));

    let jadi = false;
    for (const lompat of ["1", "0"]) {
      try {
        await jalankan("ffmpeg", ["-nostdin", "-y", "-ss", lompat, "-i", masukan,
          "-frames:v", "1", "-vf", "scale=min(720\\,iw):-2", "-q:v", "4", keluaran],
          { timeout: 30_000 });
      } catch { /* coba tanpa lompatan */ }
      if (await stat(keluaran).then(() => true).catch(() => false)) { jadi = true; break; }
    }
    if (!jadi) return null;

    const key = `poster/${randomUUID()}.jpg`;
    await s3.send(new PutObjectCommand({
      Bucket: cfg.bucket, Key: key, Body: await readFile(keluaran), ContentType: "image/jpeg",
    }));
    return AWALAN + key;
  } finally {
    await rm(kerja, { recursive: true, force: true });
  }
}

async function main() {
  console.log(`Mode: ${APPLY ? "APPLY (menulis)" : "DRY-RUN (tak menulis)"} | bucket=${cfg.bucket}`);
  const baris = await prisma.events.findMany({ select: { id: true, title_id: true, media: true } });

  let perluBackfill = 0, berhasil = 0, gagal = 0;
  for (const e of baris) {
    const media = Array.isArray(e.media) ? e.media : null;
    if (!media) continue;

    // Video dalam media yang belum punya poster.
    const target = media.filter((m) => m && m.type === "video" && m.path && !m.poster);
    if (target.length === 0) continue;

    perluBackfill++;
    console.log(`\n#${e.id} "${String(e.title_id).slice(0, 50)}" — ${target.length} video tanpa poster`);
    if (!APPLY) {
      for (const v of target) console.log(`   akan dibuatkan poster untuk: ${v.path}`);
      continue;
    }

    let berubah = false;
    for (const v of target) {
      try {
        const poster = await buatPoster(v.path);
        if (poster) { v.poster = poster; berubah = true; berhasil++; console.log(`   ✓ poster: ${poster}`); }
        else { gagal++; console.log(`   ✗ gagal buat poster: ${v.path}`); }
      } catch (err) {
        gagal++; console.log(`   ✗ error: ${v.path} — ${err?.message}`);
      }
    }
    if (berubah) {
      await prisma.events.update({ where: { id: e.id }, data: { media, updated_at: new Date() } });
      console.log(`   media #${e.id} diperbarui`);
    }
  }

  console.log(`\nSelesai. Event perlu backfill: ${perluBackfill}` +
    (APPLY ? ` | poster dibuat: ${berhasil} | gagal: ${gagal}` : " (dry-run — belum ada perubahan)"));
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
