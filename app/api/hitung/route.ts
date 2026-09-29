import { connection } from "next/server";
import { hitungLangsung } from "@/lib/suka";

const MAKS_ID = 60;

/** Angka hidup kartu umpan: GET /api/hitung?id=1,2,3 → { [id]: { suka, komentar } }.
 *  Sengaja tanpa cache — umpan (ambilUmpan) tetap di-cache, hanya angkanya
 *  yang dibaca ulang di sini. */
export async function GET(request: Request) {
  await connection();
  const ids = [...new Set(
    (new URL(request.url).searchParams.get("id") ?? "")
      .split(",")
      .map(Number)
      .filter((n) => Number.isInteger(n) && n > 0),
  )].slice(0, MAKS_ID);
  if (ids.length === 0) return Response.json({}, { headers: { "Cache-Control": "no-store" } });
  return Response.json(await hitungLangsung(ids), { headers: { "Cache-Control": "no-store" } });
}
