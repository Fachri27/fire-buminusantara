import { NextResponse } from "next/server";
import { saranDariTitik } from "@/lib/geo";
import { bacaSesi, bolehKelola } from "@/lib/sesi";

/**
 * Saran nama "ikuti pin" untuk form kejadian.
 *
 * Editor menaruh/menggeser pin di peta → klien memanggil endpoint ini
 * (debounce) → nama tempat tepat di titik itu ditawarkan lewat tombol
 * "Pakai". Sama seperti /api/lokasi: lewat server (kunci nominatim tidak
 * ada, tapi panggilan OSM-nya diseragamkan + dibatasi di sini) dan hanya
 * untuk pengguna CMS.
 */
export async function GET(req: Request) {
  const sesi = await bacaSesi();
  if (!sesi || !bolehKelola(sesi.peran)) {
    return NextResponse.json({ message: "Tidak berwenang." }, { status: 403 });
  }

  const url = new URL(req.url);
  const lat = Number(url.searchParams.get("lat") ?? "");
  const lng = Number(url.searchParams.get("lng") ?? "");
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ message: "Koordinat tidak sah." }, { status: 400 });
  }

  const saran = await saranDariTitik(lat, lng);
  return NextResponse.json(
    { saran },
    { headers: { "Cache-Control": "no-cache, no-store, must-revalidate" } },
  );
}
