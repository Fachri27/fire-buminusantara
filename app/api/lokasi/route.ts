import { NextResponse } from "next/server";
import { cariLokasi } from "@/lib/geo";
import { bacaSesi, bolehKelola } from "@/lib/sesi";

/**
 * Pencarian lokasi untuk form kejadian.
 *
 * Diproksikan lewat server: kredensial database PostGIS tidak boleh sampai ke
 * peramban, dan hanya pengguna CMS yang boleh memakainya.
 */
export async function GET(req: Request) {
  const sesi = await bacaSesi();
  if (!sesi || !bolehKelola(sesi.peran)) {
    return NextResponse.json({ message: "Tidak berwenang." }, { status: 403 });
  }

  const q = new URL(req.url).searchParams.get("q") ?? "";
  const hasil = await cariLokasi(q);
  return NextResponse.json({ hasil });
}