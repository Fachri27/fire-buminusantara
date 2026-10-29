import { after, connection, type NextRequest } from "next/server";
import { BATAS_BASI_MS, bacaHotspot, segarkanHotspot } from "@/lib/hotspot-firms";
import { jsonTermampat } from "@/lib/kompres";
import type { DataHotspot } from "@/lib/lapisan-hotspot";

/**
 * Titik hotspot NASA FIRMS satu hari WIB (lib/hotspot-firms.ts):
 * ?hari=YYYY-MM-DD, tanpa itu hari terbaru; hari di luar 7 hari data diganti
 * hari tersedia terdekat (lihat bacaHotspot — field `hari` jawabannya). Hanya
 * membaca salinan yang ditulis cron warm-asap ke Redis — pengunjung tidak
 * pernah menunggu FIRMS. Dua pengecualian: Redis masih kosong (request ikut
 * menunggu pengambilan pertama), dan salinan sudah basi karena cron tak
 * berjalan (penyegaran dipicu di latar, paling sering tiap JEDA_PICU).
 * Cache Components: connection() menahan rute ini dari prerender.
 */

const JEDA_PICU = 2 * 60 * 1000;
let picuBerikut = 0;

function kirim(req: Request, data: DataHotspot) {
  const sisa = Math.floor((Date.parse(data.diambil) + BATAS_BASI_MS - Date.now()) / 1000);
  const basi = sisa <= 0;
  return jsonTermampat(
    req,
    { ...data, basi },
    {
      headers: {
        // Ditahan paling lama sampai salinan ini basi — bukan max-age tetap.
        "Cache-Control": basi ? "no-store" : `public, max-age=${Math.min(300, sisa)}`,
      },
    },
  );
}

function galat() {
  return Response.json(
    { galat: "Server NASA FIRMS sedang tak terjangkau." },
    { status: 502, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(req: NextRequest) {
  await connection();

  const diminta = req.nextUrl.searchParams.get("hari");
  const hari = diminta && /^\d{4}-\d{2}-\d{2}$/.test(diminta) ? diminta : null;
  const data = await bacaHotspot(hari);
  if (data) {
    // Jaring pengaman bila cron mati — bukan jalur normal penyegaran.
    if (Date.now() - Date.parse(data.diambil) > BATAS_BASI_MS && Date.now() >= picuBerikut) {
      picuBerikut = Date.now() + JEDA_PICU;
      after(() => segarkanHotspot().catch(() => {}));
    }
    return kirim(req, data);
  }

  // Belum pernah ada salinan: terpaksa menunggu pengambilan pertama.
  if (Date.now() < picuBerikut) return galat();
  try {
    await segarkanHotspot();
    const baru = await bacaHotspot(hari);
    if (baru) return kirim(req, baru);
  } catch {
    // FIRMS tak terjangkau — galat di bawah.
  }
  picuBerikut = Date.now() + JEDA_PICU;
  return galat();
}
