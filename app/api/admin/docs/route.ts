import { redirect } from "next/navigation";
import { pastikanBolehKelola } from "@/lib/sesi";

// Swagger UI dari CDN, versi dipatok + SRI: tidak menambah dependensi, dan
// berkas CDN yang diubah orang ditolak peramban.
const SWAGGER = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.34.0";

const HTML = `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>API LAPORIN</title>
<link rel="stylesheet" href="${SWAGGER}/swagger-ui.css" integrity="sha384-4c3vsE5f+trhFyHrFrLM1fFGUn531NIaC7dcqEWIJdoRQJ5CkJbSuSCwXLpaS1KF" crossorigin="anonymous">
</head>
<body>
<div id="swagger-ui"></div>
<script src="${SWAGGER}/swagger-ui-bundle.js" integrity="sha384-9Td7MKiIr2S83E1kZyyVi8KdJw/S8CpAvu0llLyMeg0xq/hDGiZJfVn0fV4llCmK" crossorigin="anonymous"></script>
<script>SwaggerUIBundle({ url: "/api/admin/openapi", dom_id: "#swagger-ui", persistAuthorization: true });</script>
</body>
</html>`;

/** GET /api/admin/docs — Swagger UI untuk /api. Hanya admin/editor; cookie
 *  sesi CMS ikut terkirim saat "Try it out" karena satu asal. */
export async function GET() {
  if (!(await pastikanBolehKelola())) redirect("/admin/login");
  return new Response(HTML, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
