import { pastikanBolehKelola } from "@/lib/sesi";
import SPEK_OPENAPI from "@/lib/openapi.json" with { type: "json" };

/** GET /api/admin/openapi — spesifikasi OpenAPI seluruh /api, hanya untuk admin/editor. */
export async function GET() {
  if (!(await pastikanBolehKelola())) return Response.json({ galat: "Masuk dulu." }, { status: 401 });
  return Response.json(SPEK_OPENAPI, { headers: { "Cache-Control": "no-store" } });
}
