import { penggunaDari } from "@/lib/akun-mobile";
import { lewatBatasIp } from "@/lib/batas-laju";
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
  const isi = await req.json().catch(() => null);
  const pengguna = await penggunaDari(req);
  const [status, jawab] = await tokenWarga(String(isi?.ruang ?? ""), pengguna);
  return Response.json(jawab, { status });
}
