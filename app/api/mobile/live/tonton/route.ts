import { penggunaDari } from "@/lib/akun-mobile";
import { bacaJson } from "@/lib/batas-badan";
import { lewatBatas, lewatBatasIp } from "@/lib/batas-laju";
import { tokenWarga } from "@/lib/siaran";
import { ipDari } from "@/lib/turnstile";

/**
 * POST /api/mobile/live/tonton { ruang } → { url, token } untuk menonton siaran
 * publik. Tanpa Bearer sah token hanya untuk menonton (canPublishData: false):
 * komentar, hati, dan hadiah butuh akun.
 */
export async function POST(req: Request) {
  const ip = ipDari(req);
  if (await lewatBatasIp("tonton", ip, 60, 600)) {
    return Response.json({ galat: "Terlalu sering. Coba lagi sebentar lagi." }, { status: 429 });
  }
  const isi = await bacaJson(req);
  if (isi instanceof Response) return isi;
  const pengguna = await penggunaDari(req);
  // Per ruang: satu pengirim tidak boleh mengisi 50 kursi warga atau menghabiskan
  // jatah token ruang itu sendirian. Akun dihitung per akun, bukan per IP (CGNAT).
  const ruang = String(isi?.ruang ?? "").slice(0, 100);
  const terlalu = pengguna
    ? await lewatBatas(`tonton-akun:${pengguna.id}:${ruang}`, 5, 600)
    : await lewatBatasIp(`tonton:${ruang}`, ip, 5, 600);
  if (terlalu) return Response.json({ galat: "Terlalu sering. Coba lagi sebentar lagi." }, { status: 429 });
  const [status, jawab] = await tokenWarga(ruang, pengguna);
  return Response.json(jawab, { status });
}
