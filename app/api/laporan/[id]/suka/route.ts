import { dalamJeda, KALI_TANPA_IP, lewatBatasIp } from "@/lib/batas-laju";
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
 *   3. Laju per perangkat (ketukan beruntun) dan per IP (jendela 10 menit,
 *      lewatBatasIp: IP tak terbaca berbagi satu ember).
 *   4. Batas keras di basis data: paling banyak BATAS_PER_IP suka per IP per
 *      kejadian — tanpa ini, bot cukup mengganti user agent untuk menambah
 *      suka tanpa batas dari satu IP. Suka tanpa IP terbaca (ip_address null)
 *      dihitung sebagai satu IP bersama, dengan batas KALI_TANPA_IP lipat.
 *      Kelebihannya ditolak DIAM-DIAM (jawaban sukses dengan angka apa adanya)
 *      supaya bot tak tahu ia terhadang.
 */

const JEDA_MS = 500;
const JENDELA_IP_DETIK = 10 * 60;
const MAKS_PER_JENDELA_IP = 60;
/** Satu IP bisa dipakai bersama (rumah, kantor, NAT operator seluler). */
const BATAS_PER_IP = 5;

const POLA_BOT = /bot|crawl|spider|slurp|curl|wget|python|httpie|axios|node-fetch|undici|go-http|java\/|okhttp|libwww|headless|phantom|puppeteer|playwright|selenium|scrapy/i;

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
  if (dalamJeda(`suka:${ip}|${ua}|${id}`, JEDA_MS) || (await lewatBatasIp("suka-web", ip, MAKS_PER_JENDELA_IP, JENDELA_IP_DETIK))) {
    return Response.json({ message: "Terlalu cepat." }, { status: 429 });
  }

  if (!(await prisma.events.findFirst({ where: { id, ...TAYANG }, select: { id: true } }))) {
    return Response.json({ message: "Laporan tidak ditemukan." }, { status: 404 });
  }

  const penuh = suka
    && (await prisma.event_likes.count({ where: { event_id: id, ip_address: ip } })) >= (ip ? BATAS_PER_IP : BATAS_PER_IP * KALI_TANPA_IP);
  if (!penuh) await (suka ? sukai(id, ip, ua) : batalSuka(id, ip, ua));
  return Response.json({ jumlah: await jumlahSuka(id) });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return tangani(req, params, true);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return tangani(req, params, false);
}
