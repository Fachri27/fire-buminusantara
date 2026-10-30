import { connection } from "next/server";
import { daftarSiaranPublik } from "@/lib/siaran";

/** GET /api/mobile/live → siaran publik untuk kartu LIVE di beranda aplikasi.
 *  Cache Components: tanpa connection() rute ini diprerender saat build — tanpa
 *  LIVEKIT_* di build Docker, hasilnya `[]` beku selamanya. */
export async function GET() {
  await connection();
  const [status, isi] = await daftarSiaranPublik();
  return Response.json(isi, { status, headers: { "Cache-Control": "no-store" } });
}
