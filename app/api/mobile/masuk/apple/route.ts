import { buatSesiMobile, galat, penggunaApple, publik, simpanTokenApple, verifikasiApple } from "@/lib/akun-mobile";
import { lewatBatasIp } from "@/lib/batas-laju";
import { ipDari } from "@/lib/turnstile";

/**
 * POST /api/mobile/masuk/apple { identityToken, nama?, authorizationCode? } → { token, pengguna }
 *
 * Sign in with Apple dari aplikasi iOS — wajib menurut App Store Review
 * Guideline 4.8 karena aplikasi juga menawarkan login Google. authorizationCode
 * ditukar menjadi refresh_token yang dicabut saat akun dihapus (5.1.1(v)).
 */
export async function POST(req: Request) {
  const ip = ipDari(req);
  if (await lewatBatasIp("masuk-mobile", ip, 20, 600)) {
    return galat("Terlalu banyak percobaan masuk. Coba lagi dalam 10 menit.", 429);
  }
  const isi = await req.json().catch(() => null);
  const klaim = await verifikasiApple(String(isi?.identityToken ?? ""));
  if ("galat" in klaim) return galat(klaim.galat, klaim.status);

  const pengguna = await penggunaApple(klaim, String(isi?.nama ?? ""));
  if ("galat" in pengguna) return galat(pengguna.galat, pengguna.status);
  if (isi?.authorizationCode) await simpanTokenApple(pengguna.id, String(isi.authorizationCode), klaim.klien);
  return Response.json({ token: await buatSesiMobile(pengguna.id), pengguna: publik(pengguna) });
}
