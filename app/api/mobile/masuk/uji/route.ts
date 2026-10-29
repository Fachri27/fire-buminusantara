import { buatSesiMobile, masukUjiBoleh, penggunaUji, publik } from "@/lib/akun-mobile";
import { bacaJson } from "@/lib/batas-badan";

/**
 * POST /api/mobile/masuk/uji { nama } → { token, pengguna }
 *
 * Hanya untuk mengembangkan aplikasi terhadap `next dev` tanpa OAuth Google:
 * tombol "Masuk uji" di aplikasi muncul di dev server saja. Di produksi, atau
 * tanpa MOBILE_MASUK_UJI=1, rute ini tidak ada (404).
 */
export async function POST(req: Request) {
  if (!masukUjiBoleh()) return new Response(null, { status: 404 });
  const isi = await bacaJson(req);
  if (isi instanceof Response) return isi;
  const pengguna = await penggunaUji(String(isi?.nama ?? ""));
  return Response.json({ token: await buatSesiMobile(pengguna.id), pengguna: publik(pengguna) });
}
