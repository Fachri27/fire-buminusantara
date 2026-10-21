import { after, connection } from "next/server";
import { redisGet, redisSet } from "@/lib/redis";
import { provinsiDariTitik } from "@/lib/provinsi-titik";
import { BATAS_NUSANTARA } from "@/lib/kamera-nusantara";
import { SATELIT_HOTSPOT, type DataHotspot } from "@/lib/lapisan-hotspot";

/**
 * Titik hotspot (anomali panas) 24 jam terakhir untuk lapisan tambahan
 * "Titik Hotspot" peta (lib/lapisan-hotspot.ts, menu lapisan di peta.tsx).
 *
 * Sumber: hanya NASA FIRMS — berkas CSV publik per wilayah (South East Asia),
 * satelit yang sama dengan SiPongi KLHK — MODIS 1 km (Terra & Aqua) dan VIIRS
 * 375 m (S-NPP, NOAA-20) — ditambah VIIRS NOAA-21. Berkas wilayah ini tidak
 * butuh MAP_KEY (API area FIRMS butuh), dan diperbarui FIRMS beberapa kali
 * sehari mengikuti lintasan satelit. Titik disaring ke 34 provinsi lewat
 * provinsiDariTitik: titik di laut (suar gas lepas pantai) dan negara
 * tetangga terbuang, dan tiap titik membawa nama provinsinya.
 *
 * Musim kemarau bisa >20 ribu titik/hari, jadi respons berupa larik ringkas,
 * bukan GeoJSON (~1 MB vs ~3,6 MB sebelum gzip); klien yang merangkainya.
 *
 * Cache dalam-memori 30 menit, disajikan stale-while-revalidate: data yang ada
 * (dari memori, atau Redis bila server baru menyala) selalu langsung dikirim,
 * dan bila sudah lewat umurnya penyegaran berjalan di latar lewat after() —
 * pengambilan FIRMS tak boleh ditunggu pengunjung. Hanya bila belum pernah ada
 * data sama sekali request ikut menunggu. Satu pengambilan bersama untuk
 * request yang datang bersamaan. Tiap berkas dicoba di server utama FIRMS lalu
 * cadangannya (firms2, juga milik NASA). Bila FIRMS tak terjangkau, data FIRMS
 * terakhir yang berhasil tetap dilayani (ditandai `basi`) — dari memori, atau
 * dari Redis bila server baru menyala — dan FIRMS tidak dicoba lagi selama
 * JEDA_GAGAL, supaya selama gangguan pengunjung tak menunggu di tiap request. Cache Components:
 * connection() menahan rute ini dari prerender — isinya bergantung pada waktu
 * request.
 */

/** Server utama FIRMS lalu cadangannya — NASA mengarahkan ke firms2 saat pemeliharaan. */
const SERVER_FIRMS = ["https://firms.modaps.eosdis.nasa.gov", "https://firms2.modaps.eosdis.nasa.gov"];
/** Urutan = indeks satelit di SATELIT_HOTSPOT (bentuk penanda & legenda). */
const BERKAS = [
  "/data/active_fire/modis-c6.1/csv/MODIS_C6_1_SouthEast_Asia_24h.csv",
  "/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_SouthEast_Asia_24h.csv",
  "/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_SouthEast_Asia_24h.csv",
  "/data/active_fire/noaa-21-viirs-c2/csv/J2_VIIRS_C2_SouthEast_Asia_24h.csv",
].map((jalur, s) => ({ nama: SATELIT_HOTSPOT[s].label, jalur }));

const UMUR_CACHE = 30 * 60 * 1000;
/** Data tak lengkap (sebagian satelit gagal) dicoba lagi lebih cepat. */
const UMUR_CACHE_TAK_LENGKAP = 5 * 60 * 1000;
const BATAS_WAKTU = 15_000;
/** Setelah FIRMS gagal, request berikutnya langsung memakai data tersimpan selama ini. */
const JEDA_GAGAL = 2 * 60 * 1000;

/** Salinan data FIRMS terakhir yang berhasil di Redis — bertahan lintas
 *  restart server. "v4": versi sebelumnya bisa berisi data cadangan non-NASA. */
const KUNCI_REDIS = "firms:hotspot:v4";
const TTL_REDIS_DETIK = 3 * 24 * 3600;

/** Tingkat kepercayaan VIIRS → 0 rendah, 1 sedang, 2 tinggi. */
const KEPERCAYAAN: Record<string, number> = { low: 0, l: 0, nominal: 1, n: 1, high: 2, h: 2 };

/** Kepercayaan sebagai 0/1/2. MODIS memberi angka 0–100: rendah < 30,
 *  sedang 30–79, tinggi ≥ 80 (pembagian FIRMS, juga dipakai SiPongi). */
function kelasKepercayaan(nilai: string | undefined): number | undefined {
  const teks = nilai?.trim().toLowerCase() ?? "";
  if (/^\d+$/.test(teks)) {
    const angka = Number(teks);
    return angka >= 80 ? 2 : angka >= 30 ? 1 : 0;
  }
  return KEPERCAYAAN[teks];
}

/** `basi`: penyegaran terakhir gagal — yang disajikan data sebelumnya. */
let cache: { data: DataHotspot; kedaluwarsa: number; basi: boolean } | null = null;
let sedangAmbil: Promise<DataHotspot> | null = null;
let gagalSampai = 0;

/** Penampung hasil uraian berkas-berkas FIRMS. */
type Penampung = { provinsi: string[]; indeksProvinsi: Map<string, number>; titik: number[][]; terbaru: number };

function penampungBaru(): Penampung {
  return { provinsi: [], indeksProvinsi: new Map(), titik: [], terbaru: 0 };
}

/** Simpan satu deteksi bila jatuh di daratan salah satu provinsi. */
function tambahTitik(
  w: Penampung,
  lng: number,
  lat: number,
  kepercayaan: number | undefined,
  frp: number,
  waktu: number,
  satelit: number,
  malam: boolean,
) {
  const [[barat, selatan], [timur, utara]] = BATAS_NUSANTARA;
  // Pra-saring kotak Nusantara: dua pertiga titik Asia Tenggara gugur di
  // sini sebelum uji poligon provinsi yang lebih mahal.
  if (!(lng >= barat && lng <= timur && lat >= selatan && lat <= utara)) return;
  if (kepercayaan === undefined || !Number.isFinite(waktu)) return;
  const nama = provinsiDariTitik(lat, lng);
  if (!nama) return;
  let p = w.indeksProvinsi.get(nama);
  if (p === undefined) {
    p = w.provinsi.length;
    w.provinsi.push(nama);
    w.indeksProvinsi.set(nama, p);
  }
  w.titik.push([
    Math.round(lng * 1e4) / 1e4,
    Math.round(lat * 1e4) / 1e4,
    kepercayaan,
    Math.round(frp * 10) / 10 || 0,
    waktu,
    satelit,
    p,
    malam ? 1 : 0,
  ]);
  if (waktu > w.terbaru) w.terbaru = waktu;
}

/** FIRMS terjangkau? HEAD singkat ke kedua server, cukup salah satu menjawab
 *  (status apa pun). Saat FIRMS mati koneksinya menggantung sampai batas waktu,
 *  jadi tanpa ini tiap berkas menunggu 2 × 15 dtk sebelum dinyatakan gagal. */
async function firmsTerjangkau(): Promise<boolean> {
  try {
    await Promise.any(
      SERVER_FIRMS.map((server) =>
        fetch(`${server}/`, { method: "HEAD", signal: AbortSignal.timeout(5_000), cache: "no-store" }),
      ),
    );
    return true;
  } catch {
    return false;
  }
}

async function ambilCsv(jalur: string): Promise<string | null> {
  for (const server of SERVER_FIRMS) {
    try {
      const res = await fetch(server + jalur, { signal: AbortSignal.timeout(BATAS_WAKTU), cache: "no-store" });
      if (res.ok) return await res.text();
    } catch {
      // Coba server berikutnya.
    }
  }
  return null;
}

/** Urai satu berkas CSV FIRMS ke penampung. */
function urai(csv: string, satelit: number, w: Penampung) {
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
  if (Object.values(i).some((v) => v < 0)) return;
  for (let b = 1; b < baris.length; b++) {
    const c = baris[b].split(",");
    if (c.length < kolom.length) continue;
    const jam = c[i.jam].trim().padStart(4, "0");
    tambahTitik(
      w,
      Number(c[i.lng]),
      Number(c[i.lat]),
      kelasKepercayaan(c[i.kepercayaan]),
      Number(c[i.frp]),
      Date.parse(`${c[i.tanggal]}T${jam.slice(0, 2)}:${jam.slice(2)}:00Z`) / 60000,
      satelit,
      c[i.siangMalam]?.trim() === "N",
    );
  }
}

function hasil(w: Penampung, lengkap: boolean): DataHotspot {
  return {
    diperbarui: w.terbaru ? new Date(w.terbaru * 60000).toISOString() : null,
    diambil: new Date().toISOString(),
    satelit: BERKAS.map((b) => b.nama),
    lengkap,
    provinsi: w.provinsi,
    titik: w.titik,
  };
}

async function ambilFirms(): Promise<DataHotspot | null> {
  const semua = await Promise.all(BERKAS.map((b) => ambilCsv(b.jalur)));
  if (semua.every((t) => t === null)) return null;
  const w = penampungBaru();
  semua.forEach((csv, s) => {
    if (csv) urai(csv, s, w);
  });
  return hasil(w, semua.every((t) => t !== null));
}

async function ambil(): Promise<DataHotspot> {
  const firms = (await firmsTerjangkau()) ? await ambilFirms() : null;
  if (!firms) throw new Error("FIRMS tak terjangkau");
  return firms;
}

/**
 * `segar`: masih dalam umurnya — boleh ditahan peramban/CDN. Data yang sedang
 * disegarkan di latar ditandai `menyegarkan` supaya peta memintanya lagi
 * sebentar kemudian; yang gagal disegarkan ditandai `basi`.
 */
function kirim(data: DataHotspot, { basi = false, segar = true } = {}) {
  return Response.json(
    { ...data, basi, menyegarkan: !segar && !basi },
    {
      headers: {
        "Cache-Control": basi || !segar
          ? "no-store"
          : "public, max-age=300, s-maxage=900, stale-while-revalidate=1800",
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

/** Salinan Redis — dipakai saat server baru menyala dan memori masih kosong. */
async function dariRedis(): Promise<DataHotspot | null> {
  const teks = await redisGet(KUNCI_REDIS);
  if (!teks) return null;
  try {
    return JSON.parse(teks) as DataHotspot;
  } catch {
    return null;
  }
}

/** Ambil data baru (satu pengambilan bersama) lalu simpan ke memori & Redis. */
function segarkan(): Promise<DataHotspot> {
  sedangAmbil ??= ambil()
    .then((data) => {
      cache = {
        data,
        kedaluwarsa: Date.now() + (data.lengkap ? UMUR_CACHE : UMUR_CACHE_TAK_LENGKAP),
        basi: false,
      };
      void redisSet(KUNCI_REDIS, JSON.stringify(data), TTL_REDIS_DETIK);
      return data;
    })
    .catch((e: unknown) => {
      gagalSampai = Date.now() + JEDA_GAGAL;
      if (cache) cache.basi = true;
      throw e;
    })
    .finally(() => {
      sedangAmbil = null;
    });
  return sedangAmbil;
}

export async function GET() {
  await connection();

  if (!cache) {
    const simpanan = await dariRedis();
    if (simpanan) cache = { data: simpanan, kedaluwarsa: 0, basi: false };
  }
  if (cache) {
    const segar = Date.now() < cache.kedaluwarsa;
    if (!segar && Date.now() >= gagalSampai) {
      after(() => segarkan().catch(() => {}));
    }
    return kirim(cache.data, { basi: cache.basi, segar });
  }

  // Belum pernah ada data: terpaksa menunggu pengambilan pertama.
  if (Date.now() < gagalSampai) return galat();
  try {
    return kirim(await segarkan());
  } catch {
    return galat();
  }
}
