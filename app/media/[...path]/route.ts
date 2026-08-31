import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { getConfig, getMinioClient } from "@/lib/unggah";
import { HeadObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

const AKAR_MEDIA = path.join(process.cwd(), "media");

const JENIS: Record<string, string> = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".webp": "image/webp", ".mp4": "video/mp4", ".mov": "video/quicktime",
  ".webm": "video/webm",
};

/**
 * Melayani berkas media kejadian.
 *
 * Sumber utamanya MinIO; bucketnya TIDAK dibuka untuk umum, jadi browser tidak
 * bisa mengambil objeknya langsung — route inilah yang memegang kredensial dan
 * meneruskan isinya. Sekalian menyamakan asal-usul URL media dengan halaman,
 * sehingga tidak ada urusan CORS.
 *
 * Kalau objeknya tidak ada di MinIO, berkas di folder `media/` dicoba: ke sanalah
 * unggahan jatuh ketika MinIO sedang tidak bisa ditulisi (lihat simpanBerkas).
 */
export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const bagian = (await params).path;
  const rentang = req.headers.get("range");

  return (await lewatMinio(bagian.join("/"), rentang)) ?? (await lewatLokal(bagian, rentang));
}

async function lewatMinio(kunci: string, rentang: string | null): Promise<Response | null> {
  const cfg = getConfig();
  const klien = getMinioClient();

  // headObject dulu, bukan langsung menstreamkan: ukuran dan jenisnya diperlukan
  // untuk menjawab permintaan Range, dan objek yang tidak ada ketahuan di sini —
  // sesudah aliran dimulai, kegagalannya sudah terlanjur menjadi badan respons.
  let kepala;
  try {
    kepala = await klien.send(new HeadObjectCommand({ Bucket: cfg.bucket, Key: kunci }));
  } catch {
    return null;
  }

  const ukuran = kepala.ContentLength ?? 0;
  const jenis = kepala.ContentType || JENIS[path.extname(kunci).toLowerCase()] || "application/octet-stream";
  const potongan = pecahRentang(rentang, ukuran);

  const hasil = await klien.send(
    new GetObjectCommand({
      Bucket: cfg.bucket,
      Key: kunci,
      Range: potongan ? `bytes=${potongan.awal}-${potongan.akhir}` : undefined,
    }),
  );

  // Di Node, Body SDK v3 adalah stream Readable — sama seperti createReadStream v1.
  return jawab(Readable.toWeb(hasil.Body as Readable) as ReadableStream, jenis, ukuran, potongan);
}

async function lewatLokal(bagian: string[], rentang: string | null): Promise<Response> {
  // Penjagaan path traversal
  const penuh = path.resolve(AKAR_MEDIA, ...bagian);
  if (penuh !== AKAR_MEDIA && !penuh.startsWith(AKAR_MEDIA + path.sep)) {
    return new Response("Tidak ditemukan.", { status: 404 });
  }

  let info;
  try {
    info = await stat(penuh);
  } catch {
    return new Response("Tidak ditemukan.", { status: 404 });
  }
  if (!info.isFile()) return new Response("Tidak ditemukan.", { status: 404 });

  const potongan = pecahRentang(rentang, info.size);
  const aliran = createReadStream(
    penuh,
    potongan ? { start: potongan.awal, end: potongan.akhir } : undefined,
  );

  return jawab(
    Readable.toWeb(aliran) as ReadableStream,
    JENIS[path.extname(penuh).toLowerCase()] ?? "application/octet-stream",
    info.size,
    potongan,
  );
}

type Potongan = { awal: number; akhir: number };

function jawab(badan: ReadableStream, jenis: string, ukuran: number, potongan: Potongan | null) {
  const kepala: Record<string, string> = {
    "content-type": jenis,
    // Header keamanan untuk konten unggahan (nosniff + CSP "default-src 'none'")
    // dipasang terpusat di next.config.ts untuk jalur /media — di sini tidak
    // digandakan supaya tidak muncul dua header dengan nilai berbeda.
    // Tanpa ini browser memutar video dari awal saja: tanpa Range ia tidak bisa
    // melompat ke tengah, dan Safari malah menolak memutarnya sama sekali.
    "accept-ranges": "bytes",
    "cache-control": "public, max-age=31536000, immutable",
  };

  if (potongan) {
    kepala["content-length"] = String(potongan.akhir - potongan.awal + 1);
    kepala["content-range"] = `bytes ${potongan.awal}-${potongan.akhir}/${ukuran}`;
    return new Response(badan, { status: 206, headers: kepala });
  }

  kepala["content-length"] = String(ukuran);
  return new Response(badan, { headers: kepala });
}

/** "bytes=0-1023", "bytes=1024-", "bytes=-500". Bentuk lain — termasuk rentang
 *  ganda, yang tidak dipakai pemutar video — dianggap tidak ada, dan berkasnya
 *  dikirim utuh. */
function pecahRentang(rentang: string | null, ukuran: number): Potongan | null {
  const cocok = /^bytes=(\d*)-(\d*)$/.exec(rentang?.trim() ?? "");
  if (!cocok || !ukuran) return null;

  const [, mulai, henti] = cocok;
  if (mulai === "" && henti === "") return null;

  const awal = mulai === "" ? Math.max(0, ukuran - Number(henti)) : Number(mulai);
  const akhir = mulai === "" || henti === "" ? ukuran - 1 : Math.min(Number(henti), ukuran - 1);

  return awal <= akhir && awal < ukuran ? { awal, akhir } : null;
}
