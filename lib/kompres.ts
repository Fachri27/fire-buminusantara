import { brotliCompressSync, constants as konstantaZlib, gzipSync } from "node:zlib";

/**
 * Jawaban JSON yang dimampatkan sesuai Accept-Encoding. Server standalone Next.js di produksi
 * tidak memampatkan jawaban route handler (terukur: /api/umpan 172 KB, /api/hotspot sampai
 * 1,2 MB pada hari puncak, mentah walau nginx meneruskan Accept-Encoding) — mahal di data
 * seluler aplikasi. Pola yang sama dengan frame di app/api/sebaran-asap: brotli mutu 5 hampir
 * sepadat mutu 11 dengan biaya CPU jauh lebih kecil. Vary mencegah proksi mencampur versi.
 */
export function jsonTermampat(
  req: Request,
  data: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
): Response {
  const mentah = Buffer.from(JSON.stringify(data));
  const terima = req.headers.get("accept-encoding") ?? "";
  const kepala: Record<string, string> = {
    "Content-Type": "application/json",
    ...init.headers,
    Vary: "Accept-Encoding",
  };
  let isi: Uint8Array = mentah;
  if (terima.includes("br")) {
    isi = brotliCompressSync(mentah, { params: { [konstantaZlib.BROTLI_PARAM_QUALITY]: 5 } });
    kepala["Content-Encoding"] = "br";
  } else if (terima.includes("gzip")) {
    isi = gzipSync(mentah);
    kepala["Content-Encoding"] = "gzip";
  }
  kepala["Content-Length"] = String(isi.byteLength);
  return new Response(isi as unknown as BodyInit, { status: init.status ?? 200, headers: kepala });
}
