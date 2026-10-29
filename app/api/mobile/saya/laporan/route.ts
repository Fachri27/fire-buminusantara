import { asalPublik, galat, penggunaDari } from "@/lib/akun-mobile";
import { TAYANG } from "@/lib/events";
import { bacaBerkasMedia, mediaLokal, urlMedia } from "@/lib/media";
import { prisma } from "@/lib/prisma";

const STATUS = { pending: "menunggu", approved: "tayang", rejected: "ditolak" } as const;

/**
 * GET /api/mobile/saya/laporan → { laporan: LaporanSaya[] }, terbaru dulu.
 * Laporan anonim tidak pernah muncul di sini: barisnya tidak punya pemilik.
 */
export async function GET(req: Request) {
  const p = await penggunaDari(req);
  if (!p) return galat("Masuk dulu.", 401);
  const baris = await prisma.public_reports.findMany({
    where: { reporter_user_id: p.id },
    orderBy: { created_at: "desc" },
    take: 200,
    select: { id: true, title: true, status: true, created_at: true, media: true, kejadian: { select: { id: true, status: true } } },
  });
  // Aplikasi menampilkan sampul apa adanya, jadi URL-nya harus mutlak. Media
  // lokal lewat pengubah ukuran Next (ubin grid ±1/3 layar): berkas aslinya foto
  // kamera ukuran penuh, boros kuota di sinyal lemah. Media warisan tetap apa
  // adanya — host-nya tak terdaftar untuk optimizer (lihat mediaLokal).
  const asal = asalPublik(req);
  return Response.json({
    laporan: baris.map((l) => {
      const berkas = bacaBerkasMedia(l.media);
      const gambar = berkas.find((b) => b.type !== "video")?.path ?? berkas.find((b) => b.poster)?.poster ?? null;
      const sampul = gambar ? urlMedia(gambar) : null;
      return {
        id: String(l.id),
        judul: l.title,
        status: STATUS[l.status],
        dibuat: (l.created_at ?? new Date(0)).toISOString(),
        sampul: sampul
          ? new URL(mediaLokal(sampul) ? `/_next/image?url=${encodeURIComponent(sampul)}&w=384&q=75` : sampul, asal).toString()
          : null,
        jumlahBerkas: berkas.length,
        // Hanya bila kejadiannya memang tayang — kejadian draft tidak ada di umpan.
        beritaId: l.kejadian && l.kejadian.status === TAYANG.status ? Number(l.kejadian.id) : null,
      };
    }),
  });
}
