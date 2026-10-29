import { daftarSiaranPublik } from "@/lib/siaran";

/** GET /api/mobile/live → siaran publik untuk kartu LIVE di beranda aplikasi. */
export async function GET() {
  const [status, isi] = await daftarSiaranPublik();
  return Response.json(isi, { status, headers: { "Cache-Control": "no-store" } });
}
