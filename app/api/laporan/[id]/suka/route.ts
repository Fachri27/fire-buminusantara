import { ipDari } from "@/lib/turnstile";
import { prisma } from "@/lib/prisma";
import { TAYANG } from "@/lib/events";
import { batalSuka, jumlahSuka, sukai } from "@/lib/suka";

/**
 * Suka pada satu laporan: POST = suka, DELETE = batal. Keduanya idempoten dan
 * mengembalikan jumlah terbaru. Tidak membatalkan cache umpan — angka di kartu
 * diperbarui optimistis di klien, umpan menyusul dalam ~1 menit.
 *
 * Penangkal bot (tanpa captcha — satu ketukan tak pantas dihadang teka-teki):
 *   1. Hanya dari halaman situs ini (Sec-Fetch-Site / Origin).
 *   2. User agent kosong atau milik perkakas/crawler ditolak.
 *   3. Laju per perangkat (ketukan beruntun) dan per IP (jendela 10 menit).
 *   4. Batas keras di basis data: paling banyak BATAS_PER_IP suka per IP per
 *      kejadian — tanpa ini, bot cukup mengganti user agent untuk menambah
 *      suka tanpa batas dari satu IP. Kelebihannya ditolak DIAM-DIAM (jawaban
 *      sukses dengan angka apa adanya) supaya bot tak tahu ia terhadang.
 */

const JEDA_MS = 500;
const JENDELA_IP_MS = 10 * 60_000;
const MAKS_PER_JENDELA_IP = 60;
/** Satu IP bisa dipakai bersama (rumah, kantor, NAT operator seluler). */
const BATAS_PER_IP = 5;

const POLA_BOT = /bot|crawl|spider|slurp|curl|wget|python|httpie|axios|node-fetch|undici|go-http|java\/|okhttp|libwww|headless|phantom|puppeteer|playwright|selenium|scrapy/i;

// ponytail: pembatas laju in-memory per proses, pindah ke Redis bila replika >1.
const ketukan = new Map<string, number>();
const jendelaIp = new Map<string, { mulai: number; n: number }>();

function lolosLaju(perangkat: string, ip: string | null): boolean {
  const sekarang = Date.now();
  if (ketukan.size > 5000) ketukan.clear();
  if (jendelaIp.size > 5000) jendelaIp.clear();

  const t = ketukan.get(perangkat);
  if (t && sekarang - t < JEDA_MS) return false;
  ketukan.set(perangkat, sekarang);

  if (!ip) return true;
  const j = jendelaIp.get(ip);
  if (!j || sekarang - j.mulai > JENDELA_IP_MS) {
    jendelaIp.set(ip, { mulai: sekarang, n: 1 });
    return true;
  }
  return ++j.n <= MAKS_PER_JENDELA_IP;
}

function dariSitusIni(req: Request): boolean {
  const situs = req.headers.get("sec-fetch-site");
  if (situs) return situs === "same-origin";
  // Peramban lama tanpa Sec-Fetch-*: cocokkan Origin dengan Host.
  const asal = req.headers.get("origin");
  if (!asal) return false;
  try {
    return new URL(asal).host === req.headers.get("host");
  } catch {
    return false;
  }
}

async function tangani(req: Request, params: Promise<{ id: string }>, suka: boolean) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return Response.json({ message: "Laporan tidak ditemukan." }, { status: 404 });
  }

  const ua = req.headers.get("user-agent")?.trim() || null;
  if (!dariSitusIni(req) || !ua || POLA_BOT.test(ua)) {
    return Response.json({ message: "Ditolak." }, { status: 403 });
  }

  const ip = ipDari(req);
  if (!lolosLaju(`${ip}|${ua}|${id}`, ip)) {
    return Response.json({ message: "Terlalu cepat." }, { status: 429 });
  }

  if (!(await prisma.events.findFirst({ where: { id, ...TAYANG }, select: { id: true } }))) {
    return Response.json({ message: "Laporan tidak ditemukan." }, { status: 404 });
  }

  const penuh = suka && ip !== null
    && (await prisma.event_likes.count({ where: { event_id: id, ip_address: ip } })) >= BATAS_PER_IP;
  if (!penuh) await (suka ? sukai(id, ip, ua) : batalSuka(id, ip, ua));
  return Response.json({ jumlah: await jumlahSuka(id) });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return tangani(req, params, true);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return tangani(req, params, false);
}
