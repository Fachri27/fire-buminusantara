import { galat, penggunaDari } from "@/lib/akun-mobile";
import { kejadianDisukaiAkun } from "@/lib/suka";

/** GET /api/mobile/saya/disukai → { disukai: number[] } (id kejadian). */
export async function GET(req: Request) {
  const p = await penggunaDari(req);
  if (!p) return galat("Masuk dulu.", 401);
  return Response.json({ disukai: await kejadianDisukaiAkun(p.id) });
}
