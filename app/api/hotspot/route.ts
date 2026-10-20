import { connection } from "next/server";
import { provinsiDariTitik } from "@/lib/provinsi-titik";
import { BATAS_NUSANTARA } from "@/lib/kamera-nusantara";
import type { DataHotspot } from "@/lib/lapisan-hotspot";

/**
 * Titik hotspot (anomali panas) 24 jam terakhir untuk lapisan tambahan
 * "Titik Hotspot" peta (lib/lapisan-hotspot.ts, menu lapisan di peta.tsx).
 *
 * Sumber: NASA FIRMS — berkas CSV publik per wilayah (South East Asia) dari
 * tiga satelit VIIRS 375 m: S-NPP, NOAA-20, NOAA-21. Berkas wilayah ini tidak
 * butuh MAP_KEY (API area FIRMS butuh), dan diperbarui FIRMS beberapa kali
 * sehari mengikuti lintasan satelit. Titik disaring ke 34 provinsi lewat
 * provinsiDariTitik: titik di laut (suar gas lepas pantai) dan negara
 * tetangga terbuang, dan tiap titik membawa nama provinsinya.
 *
 * Musim kemarau bisa >20 ribu titik/hari, jadi respons berupa larik ringkas,
 * bukan GeoJSON (~1 MB vs ~3,6 MB sebelum gzip); klien yang merangkainya.
 *
 * Cache dalam-memori 30 menit + satu pengambilan bersama untuk request yang
 * datang bersamaan. Bila FIRMS gagal, data terakhir yang berhasil tetap
 * dilayani (ditandai `basi`). Cache Components: connection() menahan rute ini
 * dari prerender — isinya bergantung pada waktu request.
 */

const AKAR_FIRMS = "https://firms.modaps.eosdis.nasa.gov/data/active_fire";
const BERKAS = [
  { nama: "S-NPP", url: `${AKAR_FIRMS}/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_SouthEast_Asia_24h.csv` },
  { nama: "NOAA-20", url: `${AKAR_FIRMS}/noaa-20-viirs-c2/csv/J1_VIIRS_C2_SouthEast_Asia_24h.csv` },
  { nama: "NOAA-21", url: `${AKAR_FIRMS}/noaa-21-viirs-c2/csv/J2_VIIRS_C2_SouthEast_Asia_24h.csv` },
];

const UMUR_CACHE = 30 * 60 * 1000;
/** Data tak lengkap (sebagian satelit gagal) dicoba lagi lebih cepat. */
const UMUR_CACHE_TAK_LENGKAP = 5 * 60 * 1000;
const BATAS_WAKTU = 20_000;

/** Tingkat kepercayaan VIIRS → 0 rendah, 1 sedang, 2 tinggi. */
const KEPERCAYAAN: Record<string, number> = { low: 0, l: 0, nominal: 1, n: 1, high: 2, h: 2 };

let cache: { data: DataHotspot; kedaluwarsa: number } | null = null;
let sedangAmbil: Promise<DataHotspot> | null = null;

async function ambilCsv(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(BATAS_WAKTU), cache: "no-store" });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

/** Urai satu berkas CSV ke `titik`; mengembalikan waktu akuisisi terbarunya. */
function urai(
  csv: string,
  satelit: number,
  indeksProvinsi: Map<string, number>,
  provinsi: string[],
  titik: number[][],
): number {
  const baris = csv.split("\n");
  const kolom = baris[0].trim().split(",");
  const i = {
    lat: kolom.indexOf("latitude"),
    lng: kolom.indexOf("longitude"),
    kepercayaan: kolom.indexOf("confidence"),
    frp: kolom.indexOf("frp"),
    tanggal: kolom.indexOf("acq_date"),
    jam: kolom.indexOf("acq_time"),
    siangMalam: kolom.indexOf("daynight"),
  };
  // Format berkas berubah — lebih baik kosong daripada salah baca kolom.
  if (Object.values(i).some((v) => v < 0)) return 0;

  const [[barat, selatan], [timur, utara]] = BATAS_NUSANTARA;
  let terbaru = 0;
  for (let b = 1; b < baris.length; b++) {
    const c = baris[b].split(",");
    const lat = Number(c[i.lat]);
    const lng = Number(c[i.lng]);
    // Pra-saring kotak Nusantara: dua pertiga titik Asia Tenggara gugur di
    // sini sebelum uji poligon provinsi yang lebih mahal.
    if (!(lng >= barat && lng <= timur && lat >= selatan && lat <= utara)) continue;
    const nama = provinsiDariTitik(lat, lng);
    if (!nama) continue;
    const kepercayaan = KEPERCAYAAN[c[i.kepercayaan]?.trim().toLowerCase()];
    if (kepercayaan === undefined) continue;
    const jam = c[i.jam].trim().padStart(4, "0");
    const waktu = Date.parse(`${c[i.tanggal]}T${jam.slice(0, 2)}:${jam.slice(2)}:00Z`) / 60000;
    if (!Number.isFinite(waktu)) continue;

    let p = indeksProvinsi.get(nama);
    if (p === undefined) {
      p = provinsi.length;
      provinsi.push(nama);
      indeksProvinsi.set(nama, p);
    }
    titik.push([
      Math.round(lng * 1e4) / 1e4,
      Math.round(lat * 1e4) / 1e4,
      kepercayaan,
      Math.round(Number(c[i.frp]) * 10) / 10 || 0,
      waktu,
      satelit,
      p,
      c[i.siangMalam]?.trim() === "N" ? 1 : 0,
    ]);
    if (waktu > terbaru) terbaru = waktu;
  }
  return terbaru;
}

async function ambil(): Promise<DataHotspot> {
  const semua = await Promise.all(BERKAS.map((b) => ambilCsv(b.url)));
  if (semua.every((t) => t === null)) throw new Error("FIRMS tak terjangkau");

  const provinsi: string[] = [];
  const indeksProvinsi = new Map<string, number>();
  const titik: number[][] = [];
  let terbaru = 0;
  semua.forEach((csv, s) => {
    if (csv) terbaru = Math.max(terbaru, urai(csv, s, indeksProvinsi, provinsi, titik));
  });

  return {
    diperbarui: terbaru ? new Date(terbaru * 60000).toISOString() : null,
    diambil: new Date().toISOString(),
    satelit: BERKAS.map((b) => b.nama),
    lengkap: semua.every((t) => t !== null),
    provinsi,
    titik,
  };
}

function kirim(data: DataHotspot, basi: boolean) {
  return Response.json(
    { ...data, basi },
    {
      headers: {
        "Cache-Control": basi
          ? "no-store"
          : "public, max-age=300, s-maxage=900, stale-while-revalidate=1800",
      },
    },
  );
}

export async function GET() {
  await connection();

  if (cache && Date.now() < cache.kedaluwarsa) return kirim(cache.data, false);

  try {
    sedangAmbil ??= ambil().finally(() => {
      sedangAmbil = null;
    });
    const data = await sedangAmbil;
    cache = {
      data,
      kedaluwarsa: Date.now() + (data.lengkap ? UMUR_CACHE : UMUR_CACHE_TAK_LENGKAP),
    };
    return kirim(data, false);
  } catch {
    if (cache) return kirim(cache.data, true);
    return Response.json(
      { galat: "Data hotspot NASA FIRMS sedang tak terjangkau." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
