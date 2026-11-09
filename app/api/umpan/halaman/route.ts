import { connection } from "next/server";
import { ambilUmpan } from "@/lib/events";
import { halamanUmpan, saringanDariUrl } from "@/lib/halaman-umpan";
import { adaBahasa, type Bahasa } from "@/lib/bahasa";
import { jsonTermampat } from "@/lib/kompres";

/** Satu halaman (UMPAN_AWAL kartu) umpan beranda untuk gulir tak berujung.
 *  Saringan (cari, dari, sampai, wilayah, urut) dikerjakan di sini atas
 *  daftar ambilUmpan yang sudah di-cache — pulau/provinsi disimpulkan dari
 *  teks lokasi, jadi tak bisa disaring SQL. /api/umpan (daftar penuh) tetap
 *  ada untuk aplikasi seluler dan pop-up peta.
 *
 *  ?setelah=<id kartu terakhir yang tampil>&kursor=<`berikut` sebelumnya>;
 *  keduanya kosong = halaman pertama. Lihat halamanUmpan soal jangkar. */
export async function GET(request: Request) {
  await connection();
  const p = new URL(request.url).searchParams;
  const minta = p.get("bahasa");
  const bahasa: Bahasa = adaBahasa(minta ?? "") ? (minta as Bahasa) : "id";
  const { kursor, setelah, ...saringan } = saringanDariUrl(p);
  return jsonTermampat(request, halamanUmpan(await ambilUmpan(bahasa), saringan, kursor, setelah), {
    headers: { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600" },
  });
}
