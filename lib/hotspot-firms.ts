import { redisGet, redisSet } from "./redis.ts";
import { provinsiDariTitik } from "./provinsi-titik.ts";
import { BATAS_NUSANTARA } from "./kamera-nusantara.ts";
import { SATELIT_HOTSPOT, type DataHotspot } from "./lapisan-hotspot.ts";

/**
 * Titik hotspot (anomali panas) 24 jam terakhir untuk lapisan "Titik Hotspot"
 * peta (lib/lapisan-hotspot.ts) — pola yang sama dengan sebaran asap:
 * cron warm-asap (tiap 15 menit) memanggil segarkanHotspot() yang mengambil
 * FIRMS dan menulis Redis; rute /api/hotspot hanya membaca lewat
 * bacaHotspot(). Pengunjung tidak menunggu FIRMS, dan saat FIRMS mati salinan
 * Redis terakhir tetap dilayani.
 *
 * Sumber: hanya NASA FIRMS — berkas CSV publik per wilayah (South East Asia),
 * satelit yang sama dengan SiPongi KLHK — MODIS 1 km (Terra & Aqua) dan VIIRS
 * 375 m (S-NPP, NOAA-20) — ditambah VIIRS NOAA-21. Berkas wilayah ini tidak
 * butuh MAP_KEY (API area FIRMS butuh), dan diperbarui FIRMS beberapa kali
 * sehari mengikuti lintasan satelit. Titik disaring ke 34 provinsi lewat
 * provinsiDariTitik: titik di laut (suar gas lepas pantai) dan negara
 * tetangga terbuang, dan tiap titik membawa nama provinsinya.
 *
 * Musim kemarau bisa >20 ribu titik/hari, jadi data berupa larik ringkas,
 * bukan GeoJSON (~1 MB vs ~3,6 MB sebelum gzip); klien yang merangkainya.
 * Relatif (bukan "@/...") supaya modul ini bisa diuji lewat node:test mentah.
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

const BATAS_WAKTU = 15_000;
/** Cron menyegarkan tiap 15 menit: lebih tua dari ini = dua putaran terlewat. */
export const BATAS_BASI_MS = 40 * 60 * 1000;
/** Salinan memori dipercaya selama ini sebelum Redis dibaca ulang — rute dan
 *  cron bisa memegang salinan modul yang berbeda; Redis yang jadi acuan. */
const UMUR_MEMORI = 60 * 1000;

/** "v4": versi sebelumnya bisa berisi data cadangan non-NASA. */
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

/** Penampung hasil uraian berkas-berkas FIRMS. */
/** `batas`: menit epoch; deteksi lebih tua dibuang. */
type Penampung = { provinsi: string[]; indeksProvinsi: Map<string, number>; titik: number[][]; terbaru: number; batas: number };

function penampungBaru(): Penampung {
  // Berkas "24h" FIRMS mencakup ±30–34 jam waktu akuisisi (24 jam pemrosesan
  // + latensi) — batas 24 jam akan membuang sepertiga data segar.
  // ponytail: batas tetap 48 jam membatasi CSV cadangan satelit yang terus
  // gagal; catat waktu ambil per CSV bila perlu batas yang lebih ketat.
  return { provinsi: [], indeksProvinsi: new Map(), titik: [], terbaru: 0, batas: Date.now() / 60000 - 48 * 60 };
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
  if (kepercayaan === undefined || !Number.isFinite(waktu) || waktu < w.batas) return;
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

/** CSV terakhir yang berhasil per satelit (memori, lalu Redis bila server baru
 *  menyala). Satelit yang gagal diambil memakai salinan ini — tanpanya satu
 *  berkas yang time-out menghapus seluruh titik satelit itu dari peta DAN dari
 *  salinan Redis sampai penyegaran berikutnya berhasil. */
const csvTerakhir: (string | null)[] = BERKAS.map(() => null);
const kunciCsv = (s: number) => `firms:csv:v1:${s}`;

async function ambilFirms(): Promise<DataHotspot> {
  if (!(await firmsTerjangkau())) throw new Error("FIRMS tak terjangkau");
  const baru = await Promise.all(BERKAS.map((b) => ambilCsv(b.jalur)));
  if (baru.every((t) => t === null)) throw new Error("FIRMS tak terjangkau");
  const semua = await Promise.all(
    baru.map(async (csv, s) => {
      if (csv === null) return (csvTerakhir[s] ??= await redisGet(kunciCsv(s)));
      csvTerakhir[s] = csv;
      void redisSet(kunciCsv(s), csv, TTL_REDIS_DETIK);
      return csv;
    }),
  );
  const w = penampungBaru();
  semua.forEach((csv, s) => {
    if (csv) urai(csv, s, w);
  });
  // Tetap "tak lengkap" bila ada satelit dari salinan.
  return hasil(w, baru.every((t) => t !== null));
}

let salinan: { data: DataHotspot; dibaca: number } | null = null;
let sedangAmbil: Promise<DataHotspot> | null = null;

/** Ambil FIRMS (satu pengambilan bersama) lalu simpan ke memori & Redis.
 *  Dipanggil cron warm-asap; gagal = salinan Redis lama tetap utuh. */
export function segarkanHotspot(): Promise<DataHotspot> {
  sedangAmbil ??= ambilFirms()
    .then(async (data) => {
      salinan = { data, dibaca: Date.now() };
      await redisSet(KUNCI_REDIS, JSON.stringify(data), TTL_REDIS_DETIK);
      return data;
    })
    .finally(() => {
      sedangAmbil = null;
    });
  return sedangAmbil;
}

/** Salinan terakhir tanpa menyentuh FIRMS: memori (≤ UMUR_MEMORI), lalu Redis.
 *  Redis tak terjangkau → salinan memori terakhir. null = belum pernah ada. */
export async function bacaHotspot(): Promise<DataHotspot | null> {
  if (salinan && Date.now() - salinan.dibaca < UMUR_MEMORI) return salinan.data;
  const teks = await redisGet(KUNCI_REDIS);
  if (teks) {
    try {
      const data = JSON.parse(teks) as DataHotspot;
      // String ISO sebanding leksikografis — jangan timpa salinan yang lebih baru.
      if (!salinan || data.diambil >= salinan.data.diambil) salinan = { data, dibaca: Date.now() };
    } catch {
      // Salinan rusak — pakai yang ada di memori.
    }
  }
  if (salinan) salinan.dibaca = Date.now();
  return salinan?.data ?? null;
}
