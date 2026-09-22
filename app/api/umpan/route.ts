import { connection } from "next/server";
import { ambilUmpan } from "@/lib/events";

/** Seluruh umpan (Berita[]) untuk klien — HTML halaman hanya membawa
 *  UMPAN_AWAL kartu pertama. Datanya dari cache bertag ambilUmpan;
 *  connection() mencegah rute ini diprerender saat build (tanpa DB). */
export async function GET() {
  await connection();
  return Response.json(await ambilUmpan(), {
    headers: { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600" },
  });
}
