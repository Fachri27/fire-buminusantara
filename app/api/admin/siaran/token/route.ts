import { pastikanBolehKelola } from "@/lib/sesi";
import { tokenPetugas } from "@/lib/siaran";

/** GET /api/admin/siaran/token?ruang=… → { url, token } untuk menonton dari CMS. */
export async function GET(req: Request) {
  const sesi = await pastikanBolehKelola();
  if (!sesi) return Response.json({ galat: "Masuk dulu." }, { status: 401 });
  const [status, isi] = await tokenPetugas(new URL(req.url).searchParams.get("ruang") ?? "", sesi);
  return Response.json(isi, { status });
}
