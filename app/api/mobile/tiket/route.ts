import { galat } from "@/lib/akun-mobile";
import { bacaJson } from "@/lib/batas-badan";
import { lewatBatasIp } from "@/lib/batas-laju";
import { buatTiket } from "@/lib/tiket-lapor";
import { ipDari, turnstileSah } from "@/lib/turnstile";

/**
 * POST /api/mobile/tiket { token } → { tiket }
 *
 * Padanan mintaTiketLapor (form web) untuk aplikasi: token Turnstile dari
 * halaman /api/mobile/captcha (dibuka aplikasi di WebView, warga tetap di
 * dalam aplikasi) ditukar dengan tiket 30 menit yang menumpang unggahan besar.
 */
export async function POST(req: Request) {
  const ip = ipDari(req);
  if (await lewatBatasIp("tiket-mobile", ip, 20, 600)) {
    return galat("Terlalu banyak percobaan. Coba lagi dalam 10 menit.", 429);
  }
  const isi = await bacaJson(req);
  if (isi instanceof Response) return isi;
  const token = typeof isi?.token === "string" ? isi.token : null;
  if (!(await turnstileSah(token, ip, "lapor"))) return galat("Verifikasi captcha gagal. Coba lagi.", 403);
  return Response.json({ tiket: buatTiket() });
}
