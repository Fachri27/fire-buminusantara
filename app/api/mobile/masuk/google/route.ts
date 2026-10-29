import { buatSesiMobile, galat, penggunaGoogle, publik, verifikasiGoogle } from "@/lib/akun-mobile";
import { bacaJson } from "@/lib/batas-badan";
import { lewatBatasIp } from "@/lib/batas-laju";
import { ipDari } from "@/lib/turnstile";

/**
 * POST /api/mobile/masuk/google { idToken } → { token, pengguna }
 *
 * Aplikasi masuk lewat Google Sign-In native, lalu menukar idToken-nya dengan
 * token sesi milik situs ini (lib/akun-mobile.ts).
 */
export async function POST(req: Request) {
  const ip = ipDari(req);
  if (await lewatBatasIp("masuk-mobile", ip, 20, 600)) {
    return galat("Terlalu banyak percobaan masuk. Coba lagi dalam 10 menit.", 429);
  }
  const isi = await bacaJson(req);
  if (isi instanceof Response) return isi;
  const klaim = await verifikasiGoogle(String(isi?.idToken ?? ""));
  if ("galat" in klaim) return galat(klaim.galat, klaim.status);

  const pengguna = await penggunaGoogle(klaim);
  if ("galat" in pengguna) return galat(pengguna.galat, pengguna.status);
  return Response.json({ token: await buatSesiMobile(pengguna.id), pengguna: publik(pengguna) });
}
