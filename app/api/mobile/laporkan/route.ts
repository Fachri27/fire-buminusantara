import { revalidateTag } from "next/cache";
import { galat, penggunaDari } from "@/lib/akun-mobile";
import { bacaJson } from "@/lib/batas-badan";
import { lewatBatas } from "@/lib/batas-laju";
import { catatGalat } from "@/lib/catat-galat";
import { prisma } from "@/lib/prisma";
import { ipDari } from "@/lib/turnstile";

const JENIS = ["komentar", "laporan", "siaran"] as const;
/** id komentar / id kejadian (angka), nama ruang siaran (lib/siaran.ts). */
const POLA_TARGET: Record<(typeof JENIS)[number], RegExp> = {
  komentar: /^\d{1,18}$/,
  laporan: /^\d{1,18}$/,
  siaran: /^siaran-[a-z0-9-]{1,90}$/,
};
const ALASAN =["palsu", "tidak-pantas", "kebencian", "spam", "bahaya", "lainnya"] as const;
/** Komentar disembunyikan otomatis setelah dilaporkan sekian AKUN berbeda. */
const AMBANG_SEMBUNYI = 3;
/** Hanya komentar kejadian: tabel comments dipakai bersama halaman Pasopati lain. */
const TIPE = "App\\Models\\Event";

/**
 * Teks bebas dari pelapor sebelum masuk webhook Slack/Discord: satu baris,
 * `<!channel>`/tautan Slack dan @everyone/@here Discord dipatahkan, lalu
 * dibungkus kode supaya markdown & tautan bertopeng tidak dirender — tidak bisa
 * meniru pesan alarm lain atau mem-ping seluruh kanal pengelola.
 */
function teksAman(s: string): string {
  const bersih = s
    .replace(/[\r\n\u2028\u2029]+/g, " ")
    .replace(/`/g, "'")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/@/g, "@\u200b");
  return `\`${bersih}\``;
}

/**
 * POST /api/mobile/laporkan { jenis, id, alasan, catatan? } → { ok: true }
 *
 * "Laporkan" di aplikasi mobile — syarat App Store (Guideline 1.2) dan Google
 * Play untuk konten buatan pengguna. Boleh tanpa akun (dibatasi per IP), tapi
 * hanya laporan dari AKUN yang ikut menyembunyikan komentar otomatis sambil
 * menunggu moderator di CMS: identitas tamu (IP) murah diganti, jadi satu orang
 * tidak boleh bisa membungkam komentar siapa pun. Setiap laporan juga dikirim
 * ke ALERT_WEBHOOK_URL.
 */
export async function POST(req: Request) {
  const ip = ipDari(req);
  const pengguna = await penggunaDari(req);
  if (
    (ip && (await lewatBatas(`laporkan:${ip}`, 20, 600))) ||
    (pengguna && (await lewatBatas(`laporkan-akun:${pengguna.id}`, 20, 600))) ||
    // Tamu tanpa IP terbaca (TRUSTED_PROXY_HOPS=0) berbagi satu ember, bukan lolos tanpa batas.
    (!ip && !pengguna && (await lewatBatas("laporkan:tamu-tanpa-ip", 20, 600)))
  ) {
    return galat("Terlalu banyak laporan. Coba lagi sebentar lagi.", 429);
  }

  const isi = await bacaJson(req);
  if (isi instanceof Response) return isi;
  const jenis = JENIS.find((j) => j === isi?.jenis);
  const alasan = ALASAN.find((a) => a === isi?.alasan);
  const target = String(isi?.id ?? "").trim();
  const catatan = String(isi?.catatan ?? "").trim().slice(0, 500) || null;
  // Bentuk target dikunci per jenis: ia ikut menjadi label alarm di bawah.
  if (!jenis || !POLA_TARGET[jenis].test(target)) return galat("Konten yang dilaporkan tidak dikenal.", 422);
  if (!alasan) return galat("Pilih alasan laporan.", 422);

  // Komentar yang dilaporkan harus komentar kejadian yang memang ada — bukan id
  // tebakan milik halaman lain. Yang sudah disembunyikan tetap boleh dilaporkan.
  const komentar =
    jenis === "komentar"
      ? await prisma.comments.findFirst({ where: { id: BigInt(target), commentable_type: TIPE }, select: { updated_at: true } })
      : null;
  if (jenis === "komentar" && !komentar) return galat("Komentar yang dilaporkan tidak ditemukan.", 404);

  // Satu akun cukup sekali per konten. Tamu: hanya laporan yang sama persis dari
  // IP yang sama yang dibuang — banyak warga berbagi satu IP (CGNAT), dan alasan
  // atau catatan mereka yang berbeda tetap harus sampai ke pengelola.
  const sama = pengguna ? { reporter_user_id: pengguna.id } : { reporter_user_id: null, ip_address: ip, alasan, catatan };
  if (await prisma.content_reports.findFirst({ where: { jenis, target_id: target, ...sama }, select: { id: true } })) {
    return Response.json({ ok: true });
  }

  await prisma.content_reports.create({
    // Waktu ditulis dari sini, bukan DEFAULT basis data: dibandingkan dengan
    // comments.updated_at yang juga ditulis Prisma, jadi zona waktunya sama.
    data: { jenis, target_id: target, alasan, catatan, reporter_user_id: pengguna?.id ?? null, ip_address: ip, created_at: new Date() },
  });

  if (komentar) {
    // Akun berbeda dengan laporan yang belum ditinjau moderator dan masuk sejak
    // komentar terakhir diubah — termasuk dipulihkan moderator, supaya
    // keputusannya tidak langsung dibatalkan laporan berikutnya.
    const pelapor = await prisma.content_reports.findMany({
      where: {
        jenis,
        target_id: target,
        status: "baru",
        reporter_user_id: { not: null },
        ...(komentar.updated_at && { created_at: { gte: komentar.updated_at } }),
      },
      distinct: ["reporter_user_id"],
      select: { reporter_user_id: true },
    });
    if (pelapor.length >= AMBANG_SEMBUNYI) {
      const { count } = await prisma.comments.updateMany({
        where: { id: BigInt(target), commentable_type: TIPE, is_approved: true },
        data: { is_approved: false, updated_at: new Date() },
      });
      if (count) revalidateTag("komentar", { expire: 0 });
    }
  }

  // Kabari pengelola lewat webhook alarm yang sudah ada. Label per konten:
  // catatGalat meredam satu label 5 menit, jadi label bersama membuat laporan
  // konten lain dalam 5 menit itu tidak pernah sampai.
  await catatGalat(
    `laporan-konten ${jenis}:${target}`,
    new Error(`${jenis} ${teksAman(target)} dilaporkan: ${alasan}`),
    catatan ? `catatan pelapor: ${teksAman(catatan)}` : undefined,
  );
  return Response.json({ ok: true });
}
