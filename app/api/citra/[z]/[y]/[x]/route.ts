import { after } from "next/server";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { lewatBatasIp } from "@/lib/batas-laju";
import { bacaUbin, kunciCitra, urlHulu } from "@/lib/citra-satelit";
import { ipDari } from "@/lib/turnstile";
import { getConfig, getMinioClient } from "@/lib/unggah";

/** Citra 2024 tidak berubah lagi: setahun di peramban/WebView. */
const CACHE_UBIN = "public, max-age=31536000, immutable";
/** Peta di WebView aplikasi (asal file:// / Metro) dan embed situs lain memuatnya lintas asal. */
const CORS = { "Access-Control-Allow-Origin": "*" };
const BATAS_HULU_MS = 25_000;
/**
 * Unduhan baru dari EOX per IP per 10 menit. Satu warga yang menjelajah peta jauh di bawahnya;
 * perayap yang menyalin seluruh kisi lewat server ini (mengisi MinIO, membuat IP server diblokir EOX)
 * dialihkan langsung ke EOX.
 */
const BATAS_UNDUH_IP = 600;

/** Ubin yang sedang diunduh dari EOX: permintaan serentak untuk ubin yang sama menunggu unduhan yang sama. */
const sedangDiunduh = new Map<string, Promise<Uint8Array | null>>();

/** Ubin citra satelit dari MinIO; belum ada = diambil sekali dari EOX lalu disimpan. Lihat lib/citra-satelit.ts. */
export async function GET(req: Request, { params }: { params: Promise<{ z: string; y: string; x: string }> }) {
  const { z, y, x } = await params;
  const ubin = bacaUbin(z, y, x);
  if (!ubin) return new Response("Ubin tidak sah.", { status: 400, headers: CORS });

  const kunci = kunciCitra(ubin);
  let isi = await dariMinio(kunci);
  if (!isi) {
    if (!sedangDiunduh.has(kunci) && (await lewatBatasIp("citra", ipDari(req), BATAS_UNDUH_IP, 600))) {
      return new Response(null, { status: 302, headers: { Location: urlHulu(ubin), "Cache-Control": "no-store", ...CORS } });
    }
    isi = await dariHulu(kunci, urlHulu(ubin));
  }
  if (!isi) return new Response("Citra belum tersedia.", { status: 502, headers: { "Cache-Control": "no-store", ...CORS } });

  return new Response(new Uint8Array(isi), {
    headers: { "Content-Type": "image/jpeg", "Content-Length": String(isi.byteLength), "Cache-Control": CACHE_UBIN, ...CORS },
  });
}

async function dariMinio(kunci: string): Promise<Uint8Array | null> {
  try {
    const hasil = await getMinioClient().send(new GetObjectCommand({ Bucket: getConfig().bucket, Key: kunci }));
    return (await hasil.Body?.transformToByteArray()) ?? null;
  } catch (galat) {
    const status = (galat as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
    // MinIO mati: ubin tetap dilayani dari EOX, hanya tidak tersimpan.
    if (status !== 404) console.warn("[Citra] MinIO tak terbaca:", galat instanceof Error ? galat.message : String(galat));
    return null;
  }
}

function dariHulu(kunci: string, url: string): Promise<Uint8Array | null> {
  let janji = sedangDiunduh.get(kunci);
  if (!janji) {
    janji = unduh(kunci, url).finally(() => sedangDiunduh.delete(kunci));
    sedangDiunduh.set(kunci, janji);
  }
  return janji;
}

async function unduh(kunci: string, url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(BATAS_HULU_MS) });
    if (!res.ok || !res.headers.get("content-type")?.startsWith("image/")) {
      await res.body?.cancel();
      return null;
    }
    const isi = new Uint8Array(await res.arrayBuffer());
    // Disimpan setelah respons terkirim: pengunjung tidak ikut menunggu MinIO.
    after(() =>
      getMinioClient()
        .send(new PutObjectCommand({ Bucket: getConfig().bucket, Key: kunci, Body: isi, ContentType: "image/jpeg" }))
        .catch((galat: unknown) => console.warn("[Citra] Gagal menyimpan ubin:", kunci, galat instanceof Error ? galat.message : galat)),
    );
    return isi;
  } catch {
    return null;
  }
}
