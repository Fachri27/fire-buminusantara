import { randomUUID } from "node:crypto";
import { writeFile, mkdir, unlink, stat, copyFile, readFile, mkdtemp, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

export const AWALAN_LOKAL = "fire/";

/** Jenis yang diterima, beserta ekstensi kanoniknya. Ekstensi diambil dari SINI,
 *  bukan dari nama berkas kiriman — nama berkas dikendalikan pengunggah. */
const JENIS_MEDIA = {
  "image/jpeg": { jenis: "gambar", ext: "jpg" },
  "image/png": { jenis: "gambar", ext: "png" },
  "image/webp": { jenis: "gambar", ext: "webp" },
  "video/mp4": { jenis: "video", ext: "mp4" },
  "video/quicktime": { jenis: "video", ext: "mov" },
  "video/webm": { jenis: "video", ext: "webm" },
} as const satisfies Record<string, { jenis: "gambar" | "video"; ext: string }>;

type MimeMedia = keyof typeof JENIS_MEDIA;

/**
 * Tentukan jenis berkas dari ISI-nya (magic byte), bukan dari MIME yang
 * dideklarasikan klien.
 *
 * `berkas.type` datang dari bagian multipart dan bisa dikarang: dulu ia satu-
 * satunya penjaga, jadi byte apa pun bisa masuk bucket asalkan dilabeli
 * image/png. Signature di bawah memeriksa berkasnya sendiri; nilai yang
 * dikembalikan itulah yang dipakai sebagai ContentType, sehingga label palsu
 * tidak pernah ikut tersimpan.
 */
function deteksiMime(buf: Buffer): MimeMedia | null {
  const cocok = (offset: number, ...byte: number[]) =>
    byte.every((b, i) => buf[offset + i] === b);

  // JPEG: FF D8 FF
  if (cocok(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (cocok(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  // WebP: "RIFF"...."WEBP"
  if (cocok(0, 0x52, 0x49, 0x46, 0x46) && cocok(8, 0x57, 0x45, 0x42, 0x50)) return "image/webp";
  // WebM / Matroska: EBML 1A 45 DF A3
  if (cocok(0, 0x1a, 0x45, 0xdf, 0xa3)) return "video/webm";
  // ISO-BMFF (MP4 / QuickTime .mov): box "ftyp" di offset 4, brand menyusul
  if (cocok(4, 0x66, 0x74, 0x79, 0x70)) {
    const brand = buf.toString("latin1", 8, 12);
    // Brand QuickTime = "qt  "; sisanya (isom, mp42, mp41, avc1, dsb.) → mp4.
    return brand === "qt  " ? "video/quicktime" : "video/mp4";
  }
  return null;
}

// Hardcoded config that reads from env at module load time
export const getConfig = () => ({
  endpoint: process.env.MINIO_ENDPOINT?.replace(/\/$/, "") || "http://localhost:9000",
  accessKey: process.env.MINIO_ACCESS_KEY || "minioadmin",
  secretKey: process.env.MINIO_SECRET_KEY || "minioadmin",
  bucket: process.env.MINIO_BUCKET || "fire",
});

const AKAR_MEDIA = path.join(process.cwd(), "media");

const jalankanFfmpeg = promisify(execFile);

let s3Client: S3Client | null = null;

export function getMinioClient(): S3Client {
  if (s3Client) return s3Client;

  const cfg = getConfig();
  s3Client = new S3Client({
    endpoint: cfg.endpoint,
    // MinIO mengabaikan region, tapi SDK v3 mewajibkan isinya untuk tanda tangan v4.
    region: "us-east-1",
    forcePathStyle: true,
    credentials: { accessKeyId: cfg.accessKey, secretAccessKey: cfg.secretKey },
  });
  
  console.log("[MinIO] Client ready for bucket:", cfg.bucket);
  return s3Client;
}

export type HasilUnggah = { path: string; url: string } | { galat: string };

export async function simpanBerkas(
  berkas: File,
  jenisDiharapkan?: "gambar" | "video",
): Promise<HasilUnggah> {
  if (berkas.size === 0) return { galat: "Berkas kosong." };
  if (berkas.size > 100 * 1024 * 1024) return { galat: "Ukuran berkas melebihi 100 MB." };

  // Baca isinya SEKALI, lalu tentukan jenis dari byte-nya — bukan dari MIME
  // atau nama berkas yang dikirim klien. Buffer yang sama dipakai untuk unggah
  // dan untuk cadangan lokal, jadi tidak dibaca dua kali.
  const isi = Buffer.from(await berkas.arrayBuffer());
  const mime = deteksiMime(isi);
  if (!mime) return { galat: "Jenis berkas tidak didukung." };

  const info = JENIS_MEDIA[mime];
  // Kalau pemanggil menyebut jenis yang diharapkan (mis. slot khusus gambar),
  // isi berkas harus benar-benar jenis itu — bukan video yang menyamar.
  if (jenisDiharapkan && info.jenis !== jenisDiharapkan) {
    return { galat: "Jenis berkas tidak sesuai." };
  }

  const cfg = getConfig();
  // Nama & ekstensi dari hasil deteksi, bukan dari nama berkas kiriman.
  const relatif = `${info.jenis}/${randomUUID()}.${info.ext}`;

  try {
    await getMinioClient().send(
      new PutObjectCommand({
        Bucket: cfg.bucket,
        Key: relatif,
        Body: isi,
        ContentType: mime,
      }),
    );

    // URL yang dilayani route /media, bukan alamat MinIO: bucketnya tertutup
    // untuk publik, jadi tautan langsung ke sana dijawab 403.
    const url = `/media/${relatif}`;
    console.log("[Upload OK]", { url, type: mime });

    return { path: AWALAN_LOKAL + relatif, url };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : { message: String(error), name: "Unknown" };
    console.error("[Upload ERROR]", { message: err.message, code: err.name });

    // Cadangan ke penyimpanan lokal. Ini menyelamatkan berkasnya, TAPI dulu
    // hasilnya dilaporkan seolah sukses penuh — unggahan yang tidak pernah
    // sampai ke MinIO terlihat normal di CMS. Sekarang jalur ini dicatat
    // dengan jelas supaya bisa dibedakan dari unggahan yang benar-benar naik.
    try {
      const penuh = path.join(AKAR_MEDIA, relatif);
      await mkdir(path.dirname(penuh), { recursive: true });
      await writeFile(penuh, isi);
      console.warn("[Upload FALLBACK] MinIO gagal, berkas disimpan lokal:", {
        path: penuh, alasanMinio: err.message,
      });
      return { path: AWALAN_LOKAL + relatif, url: `/media/${relatif}` };
    } catch (galatLokal) {
      console.error("[Upload GAGAL TOTAL]", {
        minio: err.message,
        lokal: galatLokal instanceof Error ? galatLokal.message : String(galatLokal),
      });
      return { galat: err.message || "Gagal menyimpan berkas." };
    }
  }
}

/**
 * Simpan satu berkas galeri; satu input menerima gambar dan video sekaligus,
 * jadi jenisnya TIDAK diberitahukan di muka — simpanBerkas() menentukannya dari
 * isi berkas. Kategori dibaca kembali dari path hasil (`gambar/…` atau
 * `video/…`), bukan dari MIME klien.
 *
 * Setiap video langsung dibekali posternya (`poster`): bingkai di detik
 * pertamanya, diunggah sebagai gambar tersendiri. Tanpa itu kartu korsel yang
 * belum giliran diputar menampilkan kotak kosong — video memang tidak
 * diunduh sampai kartunya di tengah.
 */
export async function simpanBerkasGaleri(
  berkas: File,
): Promise<{ path: string; type: "image" | "video"; poster?: string } | { galat: string }> {
  const hasil = await simpanBerkas(berkas);
  if ("galat" in hasil) return hasil;
  const video = hasil.path.startsWith(`${AWALAN_LOKAL}video/`);
  if (!video) return { path: hasil.path, type: "image" };

  const poster = await bingkaiVideo(hasil.path);
  return poster
    ? { path: hasil.path, type: "video", poster }
    : { path: hasil.path, type: "video" };
}

/**
 * Buang berkas yang dilepas dari galeri. Kegagalan sengaja tidak dilaporkan ke
 * pemanggil: berkas yatim di penyimpanan tidak merusak apa pun, sedangkan
 * membatalkan penyimpanan karena satu objek gagal dihapus akan membuang
 * seluruh suntingan admin.
 */
export async function hapusBerkas(jalur: string | null | undefined): Promise<void> {
  if (!jalur || !jalur.startsWith(AWALAN_LOKAL)) return;
  const relatif = jalur.slice(AWALAN_LOKAL.length);
  const cfg = getConfig();

  try {
    await getMinioClient().send(
      new DeleteObjectCommand({ Bucket: cfg.bucket, Key: relatif }),
    );
  } catch {
    // MinIO tidak tersedia — berkasnya mungkin tersimpan lewat jalur cadangan.
  }

  try {
    await unlink(path.join(AKAR_MEDIA, relatif));
  } catch {
    // Tidak ada salinan lokal.
  }
}

export async function bingkaiVideo(pathVideo: string): Promise<string | null> {
  if (!pathVideo.startsWith(AWALAN_LOKAL)) return null;
  const relatif = pathVideo.slice(AWALAN_LOKAL.length);

  const kerja = await mkdtemp(path.join(os.tmpdir(), "bingkai-"));
  const masukan = path.join(kerja, "masukan");
  const keluaran = path.join(kerja, "bingkai.jpg");

  try {
    // Sumber byte video: salinan cadangan lokal bila ada (jalur saat MinIO
    // mati), kalau tidak diambil dari bucket.
    try {
      await stat(path.join(AKAR_MEDIA, relatif));
      await copyFile(path.join(AKAR_MEDIA, relatif), masukan);
    } catch {
      const objek = await getMinioClient().send(
        new GetObjectCommand({ Bucket: getConfig().bucket, Key: relatif }),
      );
      if (!objek.Body) return null;
      await writeFile(masukan, await objek.Body.transformToByteArray());
    }

    // Bingkai di detik pertama; video yang lebih pendek dari lompatannya
    // diulang tanpa lompatan — bingkai pertama tetap lebih baik daripada nihil.
    // Skala memakai min(720,iw): kecil tidak diubar, besar diringankan.
    for (const lompat of ["1", "0"]) {
      await jalankanFfmpeg(
        "ffmpeg",
        ["-nostdin", "-y", "-ss", lompat, "-i", masukan, "-frames:v", "1",
         "-vf", "scale=min(720\\,iw):-2", "-q:v", "4", keluaran],
        { timeout: 20_000 },
      );
      if (await stat(keluaran).then(() => true).catch(() => false)) {
        const hasil = await simpanBerkas(
          new File([await readFile(keluaran)], "bingkai.jpg", { type: "image/jpeg" }),
        );
        return "galat" in hasil ? null : hasil.path;
      }
    }
    return null;
  } catch {
    // Poster adalah pelengkap: ffmpeg yang tidak terpasang atau video yang
    // rusak tidak boleh menggagalkan simpanan berkasnya.
    return null;
  } finally {
    await rm(kerja, { recursive: true, force: true });
  }
}