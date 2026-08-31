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

  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const geser = Math.max(0, parseInt(url.searchParams.get("offset") ?? "0", 10) || 0);
  const hasil = await cariLokasi(q, 10, geser);
  return NextResponse.json({ hasil });
}