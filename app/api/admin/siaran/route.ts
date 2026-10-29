import { pastikanBolehKelola } from "@/lib/sesi";
import { akhiriSiaran, daftarSiaran } from "@/lib/siaran";

/** GET /api/admin/siaran — semua siaran warga yang sedang berjalan, untuk CMS petugas. */
export async function GET() {
  if (!(await pastikanBolehKelola())) return Response.json({ galat: "Masuk dulu." }, { status: 401 });
  const [status, isi] = await daftarSiaran();
  return Response.json(isi, { status, headers: { "Cache-Control": "no-store" } });
}

/** DELETE /api/admin/siaran?ruang=… → { ok: true } — petugas mengakhiri siaran
 *  (mis. konten yang dilaporkan warga). */
export async function DELETE(req: Request) {
  if (!(await pastikanBolehKelola())) return Response.json({ galat: "Masuk dulu." }, { status: 401 });
  const [status, isi] = await akhiriSiaran(new URL(req.url).searchParams.get("ruang") ?? "");
  return Response.json(isi, { status });
}
