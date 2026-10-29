import { buatSesiMobile, masukUjiBoleh, penggunaUji, publik } from "@/lib/akun-mobile";

/**
 * POST /api/mobile/masuk/uji { nama } → { token, pengguna }
 *
 * Hanya untuk mengembangkan aplikasi terhadap `next dev` tanpa OAuth Google:
 * tombol "Masuk uji" di aplikasi muncul di dev server saja. Di produksi, atau
 * tanpa MOBILE_MASUK_UJI=1, rute ini tidak ada (404).
 */
export async function POST(req: Request) {
  if (!masukUjiBoleh()) return new Response(null, { status: 404 });
  const isi = await req.json().catch(() => null);
  const pengguna = await penggunaUji(String(isi?.nama ?? ""));
  return Response.json({ token: await buatSesiMobile(pengguna.id), pengguna: publik(pengguna) });
}
