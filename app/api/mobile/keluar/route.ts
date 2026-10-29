import { cabutSesi } from "@/lib/akun-mobile";

/** POST /api/mobile/keluar — token dicabut di server, bukan cuma dibuang di HP. */
export async function POST(req: Request) {
  await cabutSesi(req);
  return Response.json({ ok: true });
}
