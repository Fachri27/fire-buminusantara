import { penggunaDari } from "@/lib/akun-mobile";
import { lewatBatas, lewatBatasIp } from "@/lib/batas-laju";
import { tokenPelapor } from "@/lib/siaran";
import { ipDari } from "@/lib/turnstile";

/**
 * POST /api/mobile/live/token { judul, nama, anonim, publik, lat, lng }
 * → { url, token, ruang }. Dengan token akun (dan tidak anonim), nama pelapor
 * diambil dari akun bila kosong.
 *
 * Siaran publik (tampil di beranda semua warga, tanpa moderasi lebih dulu)
 * wajib akun dan tidak boleh anonim — harus ada yang bisa dilaporkan dan
 * dimintai tanggung jawab. Siaran khusus petugas tetap boleh tamu/anonim.
 */
export async function POST(req: Request) {
  const ip = ipDari(req);
  // Siaran lebih mahal dari laporan: 3 siaran / 10 menit / IP.
  if (await lewatBatasIp("live", ip, 3, 600)) {
    return Response.json({ galat: "Terlalu banyak siaran dari jaringan ini. Coba lagi nanti." }, { status: 429 });
  }
  const isi = await req.json().catch(() => null);
  if (!isi) return Response.json({ galat: "Kiriman tidak bisa dibaca server." }, { status: 400 });
  const publik = isi.publik === true;
  if (publik && isi.anonim === true) {
    return Response.json({ galat: "Siaran di beranda warga tidak bisa anonim." }, { status: 422 });
  }
  const pengguna = isi.anonim === true ? null : await penggunaDari(req);
  if (publik && !pengguna) {
    return Response.json({ galat: "Masuk dulu untuk menyiarkan ke beranda warga." }, { status: 401 });
  }
  if (pengguna && (await lewatBatas(`live-akun:${pengguna.id}`, 3, 600))) {
    return Response.json({ galat: "Terlalu banyak siaran. Coba lagi nanti." }, { status: 429 });
  }
  const [status, jawab] = await tokenPelapor(isi, pengguna?.name ?? null);
  return Response.json(jawab, { status });
}
