import { randomUUID } from "node:crypto";
import { writeFile, mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const GAMBAR = ["image/jpeg", "image/png", "image/webp"];
const VIDEO = ["video/mp4", "video/quicktime", "video/webm"];

export const AWALAN_LOKAL = "fire/";

// Hardcoded config that reads from env at module load time
export const getConfig = () => ({
  endpoint: process.env.MINIO_ENDPOINT?.replace(/\/$/, "") || "http://localhost:9000",
  accessKey: process.env.MINIO_ACCESS_KEY || "minioadmin",
  secretKey: process.env.MINIO_SECRET_KEY || "minioadmin",
  bucket: process.env.MINIO_BUCKET || "fire",
});

const AKAR_MEDIA = path.join(process.cwd(), "media");

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

function amanNama(nama: string): string {
  // Ekstensi = segmen TERAKHIR, bukan yang kedua. Nama berkas dari ponsel kerap
  // memuat titik di tengah ("WhatsApp Video 2026-08-28 at 19.07.35.mp4") — dengan
  // segmen kedua, berkasnya tersimpan berakhiran ".07" dan route /media melayani
  // application/octet-stream, jadi videonya tidak pernah bisa diputar.
  const bersih = nama.toLowerCase().replace(/[^.a-z0-9]/g, "");
  const bagian = bersih.split(".");
  const ext = bagian.length > 1 ? bagian[bagian.length - 1] : "";
  return `${randomUUID()}.${ext || "jpg"}`;
}

export async function simpanBerkas(berkas: File, jenis: "gambar" | "video"): Promise<HasilUnggah> {
  if (berkas.size === 0) return { galat: "Berkas kosong." };
  if (berkas.size > 100 * 1024 * 1024) return { galat: "Ukuran berkas melebihi 100 MB." };

  const diterima = jenis === "gambar" ? GAMBAR : VIDEO;
  if (!diterima.includes(berkas.type)) {
    return { galat: "Jenis berkas tidak didukung." };
  }

  const cfg = getConfig();
  const nama = amanNama(berkas.name);
  const relatif = `${jenis}/${nama}`;
  
  try {
    const client = getMinioClient();
    const arrayBuffer = await berkas.arrayBuffer();
    
    await client.send(
      new PutObjectCommand({
        Bucket: cfg.bucket,
        Key: relatif,
        Body: Buffer.from(arrayBuffer),
        ContentType: berkas.type,
      }),
    );
    
    // URL yang dilayani route /media, bukan alamat MinIO: bucketnya tertutup
    // untuk publik, jadi tautan langsung ke sana dijawab 403.
    const url = `/media/${relatif}`;
    console.log("[Upload OK]", { url, type: berkas.type });
    
    return { path: AWALAN_LOKAL + relatif, url };
    
  } catch (error: any) {
    console.error("[Upload ERROR]", { message: error.message, code: error.name });
    
    // Fallback ke local storage
    try {
      const penuh = path.join(AKAR_MEDIA, relatif);
      await mkdir(path.dirname(penuh), { recursive: true });
      const arrayBuffer = await berkas.arrayBuffer();
      await writeFile(penuh, Buffer.from(arrayBuffer));
      return { path: AWALAN_LOKAL + relatif, url: `/media/${relatif}` };
    } catch {
      return { galat: error.message };
    }
  }
}

/**
 * Simpan satu berkas galeri; jenisnya ditentukan dari MIME berkasnya sendiri
 * karena satu input menerima gambar dan video sekaligus.
 */
export async function simpanBerkasGaleri(
  berkas: File,
): Promise<{ path: string; type: "image" | "video" } | { galat: string }> {
  const video = berkas.type.startsWith("video/");
  const hasil = await simpanBerkas(berkas, video ? "video" : "gambar");
  if ("galat" in hasil) return hasil;
  return { path: hasil.path, type: video ? "video" : "image" };
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

export async function bingkaiVideo(_pathVideo: string): Promise<string | null> {
  return null;
}