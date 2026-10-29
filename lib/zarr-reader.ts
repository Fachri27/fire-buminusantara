import Blosc from "numcodecs/blosc";
import { redisGet, redisSet, redisGetBuffer, redisSetBuffer } from "./redis.ts";
import { awalRiwayat } from "./lapisan-hotspot.ts";

const ZARR_BASE_URL =
  process.env.CAMS_ZARR_BASE_URL ||
  "https://arco.datastores.ecmwf.int/cadl-arco-time-001/arco/cams_global_atmospheric_composition_forecasts/sfc-multiforecast/timeChunked.zarr";
const ZARR_TOKEN =
  process.env.CAMS_ZARR_TOKEN || "fire-watch-827a2651-8e26-4bc1-ac44-9351fcb916af";

// Global geospatial grid dimensions for ECMWF CAMS ARCO Zarr (omaod550, pm2p5, u10, v10, …)
// Lat: -90°S -> +90°N (step 0.4°, 451 rows; baris 0 = kutub selatan)
// Lon: -180° -> +179.6° (step 0.4°, 900 cols)
// Atribut GRIB_* di store masih menyebut 90→-90 dan 0→359.6 (sisa GRIB asal),
// tapi array koordinat `latitude`/`longitude` beserta datanya sudah diurutkan
// ulang oleh ARCO — terverifikasi dari data: angin baratan Samudra Selatan
// muncul di baris ~100 (-50°), PM2.5 Delhi/Beijing di kolom bujur timur.
export const ZARR_GLOBAL_GRID = {
  rows: 451,
  cols: 900,
  totalPoints: 451 * 900, // 405,900 points
  maxDensityAod: 2.0, // Scale factor: byte 255 = 2.0 AOD
  bounds: [
    [-90.0, -180.0],
    [90.0, 180.0],
  ] as [[number, number], [number, number]],
} as const;

// Backwards-compatible alias if needed
export const ZARR_INDO_GRID = ZARR_GLOBAL_GRID;

export interface ZarrTimestepMeta {
  index: number;
  timeChunk: number;
  timeInner: number;
  step: number;
  iso: string;
  waktu: number;
  labelUtc: string;
  labelWib: string;
  adalahPrediksi: boolean;
}

export interface ZarrMetadataResponse {
  latestModelRunIso: string;
  latestModelRunWib?: string;
  timesteps: ZarrTimestepMeta[];
  grid: {
    rows: number;
    cols: number;
    bounds: [[number, number], [number, number]];
  };
  isWarm?: boolean;
  cachedFramesCount?: number;
}

// In-memory cache & limit
export const MAX_FRAME_CACHE_ENTRIES = 150; // Menampung seluruh ~81 frame sebaran asap (~60 MB RAM)
export const CLEANUP_INTERVAL_MS = 15 * 60 * 1000; // Siklus pembersihan tiap 15 menit
let lastCleanupTime = Date.now();

/** Umur metadata (linimasa) di memori & Redis. Cron warm-asap memaksa segar
 *  tiap 30 menit (docker-compose.prod.yml); sedikit lebih lama dari itu
 *  supaya pengunjung tak pernah memicu ambil ulang ke ECMWF di antara putaran. */
const UMUR_METADATA_MS = 35 * 60 * 1000;
let cachedMetadata: { data: ZarrMetadataResponse; expiresAt: number } | null = null;
const frameCache = new Map<string, { buffer: Uint8Array; expiresAt: number }>();
const bloscCodec = Blosc.fromConfig({ id: "blosc" });

/** Jumlah float32 per chunk variabel: shape chunk [2 run, 1 step, 451, 900]. */
const NILAI_PER_CHUNK = 2 * ZARR_GLOBAL_GRID.totalPoints;

/**
 * Galat dari hulu ECMWF (HTTP non-2xx, jaringan putus, chunk rusak) —
 * kelas tersendiri supaya rute bisa menjawab 502 alih-alih 500.
 */
export class GalatHuluZarr extends Error {
  status: number | null;

  constructor(pesan: string, status: number | null = null) {
    super(pesan);
    this.name = "GalatHuluZarr";
    this.status = status;
  }
}

/**
 * Mengunduh satu objek Zarr dari ARCO lalu mendekompresi Blosc-nya.
 * `jalur` relatif terhadap akar store, mis. "pm2p5/162.0.0.0" atau "latitude/0".
 * Token sengaja tidak ikut dalam pesan galat: pesan itu diteruskan rute ke
 * klien sebagai JSON 500/502.
 */
async function ambilObjekZarr(jalur: string): Promise<Uint8Array> {
  let res: Response;
  try {
    res = await fetch(`${ZARR_BASE_URL}/${jalur}?_fet=${ZARR_TOKEN}`);
  } catch (e) {
    throw new GalatHuluZarr(`Failed to fetch Zarr chunk ${jalur}: ${e instanceof Error ? e.message : e}`);
  }
  if (!res.ok) {
    throw new GalatHuluZarr(`Failed to fetch Zarr chunk ${jalur}: ${res.status} ${res.statusText}`, res.status);
  }
  try {
    const terkompresi = new Uint8Array(await res.arrayBuffer());
    return await bloscCodec.decode(terkompresi);
  } catch (e) {
    throw new GalatHuluZarr(`Gagal membaca/dekompresi chunk Zarr ${jalur}: ${e instanceof Error ? e.message : e}`);
  }
}

/** Typed array butuh byteOffset kelipatan ukuran elemen — salin bila tidak. */
function selaraskan(data: Uint8Array, ukuranElemen: number): Uint8Array {
  return data.byteOffset % ukuranElemen === 0 ? data : data.slice();
}

/**
 * Mengunduh + mendekompresi satu chunk variabel permukaan (omaod550, pm2p5,
 * u10, v10, …) untuk (timeChunk, step). Hasilnya SELURUH chunk: 2 run
 * (timeInner 0 dan 1) × 451 × 900 float32, urutan C — irisan timeInner
 * dimulai di `timeInner * ZARR_GLOBAL_GRID.totalPoints`. Dikembalikan utuh
 * karena kedua run analisis berbagi chunk yang sama, jadi pemanggil bisa
 * memakai keduanya dari satu unduhan.
 */
export async function ambilChunkZarr(variabel: string, timeChunk: number, step: number): Promise<Float32Array> {
  const jalur = `${variabel}/${timeChunk}.${step}.0.0`;
  const data = selaraskan(await ambilObjekZarr(jalur), 4);
  const floats = new Float32Array(data.buffer, data.byteOffset, Math.floor(data.byteLength / 4));
  if (floats.length !== NILAI_PER_CHUNK) {
    throw new GalatHuluZarr(`Chunk Zarr ${jalur} berukuran tak terduga: ${floats.length} nilai (harap ${NILAI_PER_CHUNK})`);
  }
  return floats;
}

/** Array koordinat 1-D (float64, satu chunk) — "latitude" atau "longitude". */
export async function ambilKoordinatZarr(nama: "latitude" | "longitude"): Promise<Float64Array> {
  const data = selaraskan(await ambilObjekZarr(`${nama}/0`), 8);
  return new Float64Array(data.buffer, data.byteOffset, Math.floor(data.byteLength / 8));
}

/**
 * Membersihkan entri frame cache dan metadata yang sudah kedaluwarsa dari memori server.
 * Mengembalikan total jumlah entri frame yang berhasil dihapus.
 */
export function bersihkanCacheKedaluwarsa(waktuSekarang: number = Date.now()): number {
  let terhapus = 0;
  for (const [kunci, entri] of frameCache.entries()) {
    if (entri.expiresAt <= waktuSekarang) {
      frameCache.delete(kunci);
      terhapus++;
    }
  }

  if (cachedMetadata && cachedMetadata.expiresAt <= waktuSekarang) {
    cachedMetadata = null;
  }

  return terhapus;
}

/**
 * Mendapatkan jumlah entri frame yang saat ini tersimpan di memori cache server.
 */
export function getJumlahCacheFrame(): number {
  return frameCache.size;
}

/**
 * Mengosongkan seluruh cache memori server (berguna untuk testing atau paksa refresh).
 */
export function kosongkanSemuaCache(): void {
  frameCache.clear();
  cachedMetadata = null;
}

// Timer berkala otomatis di latar belakang (unref agar tidak menahan proses Node.js)
if (typeof setInterval !== "undefined") {
  const timerPembersih = setInterval(() => {
    bersihkanCacheKedaluwarsa();
  }, CLEANUP_INTERVAL_MS);
  if (timerPembersih.unref) {
    timerPembersih.unref();
  }
}

function buatMetaLangkah(
  index: number,
  timeChunk: number,
  timeInner: number,
  stepHour: number,
  baseTimeMs: number,
  adalahPrediksi: boolean
): ZarrTimestepMeta {
  const stepDate = new Date(baseTimeMs + stepHour * 3600 * 1000);
  const iso = stepDate.toISOString().replace(/\.\d{3}Z$/, "Z");
  const waktu = stepDate.getTime();

  const namaBulan = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
  const tglUtc = stepDate.getUTCDate();
  const blnUtc = namaBulan[stepDate.getUTCMonth()];
  const jamUtc = String(stepDate.getUTCHours()).padStart(2, "0");
  const menitUtc = String(stepDate.getUTCMinutes()).padStart(2, "0");

  const wib = new Date(waktu + 7 * 3600 * 1000);
  const tglWib = wib.getUTCDate();
  const blnWib = namaBulan[wib.getUTCMonth()];
  const jamWib = String(wib.getUTCHours()).padStart(2, "0");
  const menitWib = String(wib.getUTCMinutes()).padStart(2, "0");

  return {
    index,
    timeChunk,
    timeInner,
    step: stepHour,
    iso,
    waktu,
    labelUtc: `${tglUtc} ${blnUtc}, ${jamUtc}:${menitUtc} UTC`,
    labelWib: `${tglWib} ${blnWib}, ${jamWib}:${menitWib} WIB`,
    adalahPrediksi,
  };
}

/**
 * Linimasa yang dipakai peta: riwayat dipotong ke HARI_RIWAYAT hari WIB
 * (awalRiwayat) supaya Aerosol, Angin, dan hotspot mundur sejauh yang sama —
 * store CAMS sendiri menyimpan 14 run (±7,5 hari). Dipotong saat dibaca, bukan
 * saat dibangun: metadata tersimpan (memori/Redis) bisa melewati tengah malam.
 * Frame diambil lewat timeChunk/step/timeInner, jadi `index` aman dinomori ulang.
 */
export async function getZarrMetadata(forceRefresh: boolean = false): Promise<ZarrMetadataResponse> {
  const meta = await ambilZarrMetadata(forceRefresh);
  const awal = awalRiwayat();
  return { ...meta, timesteps: meta.timesteps.filter((m) => m.waktu >= awal).map((m, index) => ({ ...m, index })) };
}

/**
 * Fetch and parse Zarr metadata to identify available timesteps.
 */
async function ambilZarrMetadata(forceRefresh: boolean): Promise<ZarrMetadataResponse> {
  const now = Date.now();
  // 1. Cek L1 in-memory cache (RAM lokal)
  if (!forceRefresh && cachedMetadata && cachedMetadata.expiresAt > now) {
    const isWarm = frameCache.size >= Math.floor(cachedMetadata.data.timesteps.length * 0.7);
    return {
      ...cachedMetadata.data,
      isWarm,
      cachedFramesCount: frameCache.size,
    };
  }

  // 2. Cek L2 Redis cache terpusat
  const REDIS_KEY_META = "cams:zarr:metadata";
  if (!forceRefresh) {
    const redisMetaStr = await redisGet(REDIS_KEY_META);
    if (redisMetaStr) {
      try {
        const parsed: ZarrMetadataResponse = JSON.parse(redisMetaStr);
        if (parsed?.timesteps?.length > 0) {
          cachedMetadata = {
            data: parsed,
            expiresAt: now + UMUR_METADATA_MS,
          };
          return {
            ...parsed,
            isWarm: frameCache.size >= Math.floor(parsed.timesteps.length * 0.7),
            cachedFramesCount: frameCache.size,
          };
        }
      } catch {}
    }
  }

  // Pembersihan pasif berkala jika interval tercapai
  if (now - lastCleanupTime > CLEANUP_INTERVAL_MS) {
    lastCleanupTime = now;
    bersihkanCacheKedaluwarsa(now);
  }

  try {
    const metaUrl = `${ZARR_BASE_URL}/.zmetadata?_fet=${ZARR_TOKEN}`;
    // no-store, bukan revalidate: tembolok fetch Next tersimpan di disk dan
    // basi-sambil-revalidasi — server yang lama mati menyajikan run model
    // berhari-hari lalu pada permintaan pertama, lalu basi itu terkunci di L1
    // selama UMUR_METADATA_MS. L1 + Redis di atas sudah cukup sebagai tembolok.
    const res = await fetch(metaUrl, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Failed to fetch Zarr metadata: ${res.status} ${res.statusText}`);
    }

    const meta = await res.json();
    const omaodArray = meta.metadata["omaod550/.zarray"];
    const totalTimeRuns = omaodArray.shape[0]; // e.g. 233
    let latestTimeIndex = totalTimeRuns - 1; // e.g. 232

    // Metadata terkonsolidasi bisa mendahului objek chunk-nya (ingest lag):
    // shape mengiklankan run terbaru, tapi `omaod550/{chunk}.0.0.0`-nya belum
    // tertulis sehingga seluruh frame 404 → 500 di API. Mundurkan ke run
    // terbaru yang chunk-nya benar-benar ada supaya metadata dan frame selalu
    // konsisten. Gagal probed = fail-open (perilaku lama).
    try {
      for (let susut = 0; susut < 8 && latestTimeIndex > 0; susut++) {
        const chunkUji = Math.floor(latestTimeIndex / 2);
        const uji = await fetch(`${ZARR_BASE_URL}/omaod550/${chunkUji}.0.0.0?_fet=${ZARR_TOKEN}`, {
          method: "HEAD",
        });
        if (uji.ok) break;
        latestTimeIndex--;
      }
    } catch {
      // Abaikan — memakai latestTimeIndex dari shape seperti sebelumnya.
    }

    // 7 hari analisis historis (14 model runs ke belakang: 2 run per hari, 28 Agu - 4 Sep)
    const startRunIdx = Math.max(0, latestTimeIndex - 14);

    // Ambil chunk array time untuk run yang dibutuhkan
    const chunkIdxA = Math.floor(startRunIdx / 64);
    const chunkIdxB = Math.floor(latestTimeIndex / 64);

    const timesMap = new Map<number, number>();

    const muatTimeChunk = async (chunkIdx: number) => {
      try {
        const timeRes = await fetch(`${ZARR_BASE_URL}/time/${chunkIdx}?_fet=${ZARR_TOKEN}`);
        if (!timeRes.ok) return;
        const timeBuf = new Uint8Array(await timeRes.arrayBuffer());
        const decodedTime = await bloscCodec.decode(timeBuf);
        const times = new BigInt64Array(decodedTime.buffer, decodedTime.byteOffset, decodedTime.byteLength / 8);
        for (let i = 0; i < times.length; i++) {
          const runIdx = chunkIdx * 64 + i;
          const hoursSince1970 = Number(times[i]);
          if (hoursSince1970 > 0) {
            timesMap.set(runIdx, hoursSince1970 * 3600 * 1000);
          }
        }
      } catch (e) {
        console.warn(`[ZarrReader] Gagal memuat time chunk ${chunkIdx}:`, e);
      }
    };

    await muatTimeChunk(chunkIdxB);
    if (chunkIdxA !== chunkIdxB) {
      await muatTimeChunk(chunkIdxA);
    }

    const latestBaseMs = timesMap.get(latestTimeIndex) || now;
    const latestModelRunIso = new Date(latestBaseMs).toISOString();

    const namaBulan = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
    const wibRun = new Date(latestBaseMs + 7 * 3600 * 1000);
    const latestModelRunWib = `${wibRun.getUTCDate()} ${namaBulan[wibRun.getUTCMonth()]}, ${String(wibRun.getUTCHours()).padStart(2, "0")}:${String(wibRun.getUTCMinutes()).padStart(2, "0")} WIB`;

    const timesteps: ZarrTimestepMeta[] = [];

    // 1. Periode Analisis 7 Hari Terakhir (Historis, step per 3 jam)
    for (let runIdx = startRunIdx; runIdx < latestTimeIndex; runIdx++) {
      const timeChunk = Math.floor(runIdx / 2);
      const timeInner = runIdx % 2;
      const baseMs = timesMap.get(runIdx) || (latestBaseMs - (latestTimeIndex - runIdx) * 12 * 3600 * 1000);

      for (const stepHour of [0, 3, 6, 9]) {
        timesteps.push(
          buatMetaLangkah(
            timesteps.length,
            timeChunk,
            timeInner,
            stepHour,
            baseMs,
            false // Periode Analisis
          )
        );
      }
    }

    // 2. Periode Prediksi (Hari ini s.d. +72 jam ke depan, step per 3 jam)
    const latestChunk = Math.floor(latestTimeIndex / 2);
    const latestInner = latestTimeIndex % 2;

    for (let stepHour = 0; stepHour <= 72; stepHour += 3) {
      timesteps.push(
        buatMetaLangkah(
          timesteps.length,
          latestChunk,
          latestInner,
          stepHour,
          latestBaseMs,
          stepHour > 0 // Prediksi
        )
      );
    }

    const isWarm = frameCache.size >= Math.floor(timesteps.length * 0.7);
    const result: ZarrMetadataResponse = {
      latestModelRunIso,
      latestModelRunWib,
      timesteps,
      grid: {
        rows: ZARR_GLOBAL_GRID.rows,
        cols: ZARR_GLOBAL_GRID.cols,
        bounds: ZARR_GLOBAL_GRID.bounds,
      },
      isWarm,
      cachedFramesCount: frameCache.size,
    };

    cachedMetadata = {
      data: result,
      expiresAt: now + UMUR_METADATA_MS,
    };

    // Simpan ke L2 Redis (TTL sama)
    redisSet(REDIS_KEY_META, JSON.stringify(result), UMUR_METADATA_MS / 1000).catch(() => {});

    return result;
  } catch (error) {
    console.error("[ZarrReader] Error fetching metadata:", error);
    // Fallback if network fails
    return getFallbackMetadata();
  }
}

/**
 * Fetch and decode a specific frame chunk for the full global grid.
 * Returns a Uint8Array of 405,900 bytes (451 rows x 900 cols), values 0..255 representing 0..2.0 AOD.
 * Urutan grid diteruskan apa adanya dari store: baris 0 = -90°, kolom 0 = -180°.
 */
export async function getZarrFrame(timeChunk: number, step: number, timeInner: number = 0): Promise<Uint8Array> {
  const cacheKey = `${timeChunk}_${step}_${timeInner}`;
  const now = Date.now();

  // Pembersihan pasif berkala jika interval tercapai
  if (now - lastCleanupTime > CLEANUP_INTERVAL_MS) {
    lastCleanupTime = now;
    bersihkanCacheKedaluwarsa(now);
  }

  // 1. Cek L1 In-Memory Cache (RAM lokal proses Node.js)
  const cached = frameCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.buffer;
  }

  // 2. Cek L2 Redis Cache terpusat (berbagi lintas instance / restart)
  const redisFrameKey = `cams:zarr:frame:${timeChunk}:${step}:${timeInner}`;
  const redisBuf = await redisGetBuffer(redisFrameKey);
  if (redisBuf && redisBuf.byteLength === ZARR_GLOBAL_GRID.totalPoints) {
    const u8 = new Uint8Array(redisBuf.buffer, redisBuf.byteOffset, redisBuf.byteLength);
    // Simpan juga ke L1 RAM agar pemanggilan berikutnya di proses ini 0ms
    frameCache.set(cacheKey, {
      buffer: u8,
      expiresAt: now + 4 * 3600 * 1000,
    });
    return u8;
  }

  // 3. L3: Ambil dari sumber ECMWF ARCO Zarr (Eropa) & dekompresi Blosc
  const floats = await ambilChunkZarr("omaod550", timeChunk, step);

  // Chunk shape is [2, 1, 451, 900]
  // Offset for timeInner (0 or 1):
  const timeOffset = timeInner * 451 * 900;
  const rows = ZARR_GLOBAL_GRID.rows; // 451
  const cols = ZARR_GLOBAL_GRID.cols; // 900
  const maxDensityAod = ZARR_GLOBAL_GRID.maxDensityAod;
  const result = new Uint8Array(rows * cols);

  let outIdx = 0;
  for (let r = 0; r < rows; r++) {
    const rowOffset = timeOffset + r * cols;
    for (let c = 0; c < cols; c++) {
      const val = floats[rowOffset + c];
      // Clamp between 0.0 and maxDensityAod, map to 0..255
      const normalized = Math.min(1.0, Math.max(0.0, val / maxDensityAod));
      result[outIdx++] = Math.round(normalized * 255);
    }
  }

  // Jaga batas kapasitas memori RAM
  if (frameCache.size >= MAX_FRAME_CACHE_ENTRIES) {
    bersihkanCacheKedaluwarsa(now);
    while (frameCache.size >= MAX_FRAME_CACHE_ENTRIES) {
      const entriTertua = frameCache.keys().next().value;
      if (entriTertua) {
        frameCache.delete(entriTertua);
      } else {
        break;
      }
    }
  }

  // Simpan ke L1 in-memory cache (4 jam)
  frameCache.set(cacheKey, {
    buffer: result,
    expiresAt: now + 4 * 3600 * 1000,
  });

  // Simpan ke L2 Redis cache (TTL 24 jam / 86400 detik) agar user lain langsung menikmatinya
  redisSetBuffer(redisFrameKey, result, 24 * 3600).catch(() => {});

  return result;
}

function getFallbackMetadata(): ZarrMetadataResponse {
  const now = Date.now();
  const timesteps: ZarrTimestepMeta[] = [];

  // 14 run historis (7 hari lalu, per 3 jam)
  for (let i = 0; i < 14; i++) {
    const baseMs = now - (14 - i) * 12 * 3600 * 1000;
    const timeChunk = 109 + Math.floor(i / 2);
    const timeInner = i % 2;
    for (const step of [0, 3, 6, 9]) {
      timesteps.push(
        buatMetaLangkah(timesteps.length, timeChunk, timeInner, step, baseMs, false)
      );
    }
  }

  // 25 step prediksi (+0 s.d. +72 jam, per 3 jam)
  for (let step = 0; step <= 72; step += 3) {
    timesteps.push(
      buatMetaLangkah(timesteps.length, 116, 0, step, now, step > 0)
    );
  }

  const isWarm = frameCache.size >= Math.floor(timesteps.length * 0.7);
  const namaBulan = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
  const wibRun = new Date(now + 7 * 3600 * 1000);
  const latestModelRunWib = `${wibRun.getUTCDate()} ${namaBulan[wibRun.getUTCMonth()]}, ${String(wibRun.getUTCHours()).padStart(2, "0")}:${String(wibRun.getUTCMinutes()).padStart(2, "0")} WIB`;

  return {
    latestModelRunIso: new Date(now).toISOString(),
    latestModelRunWib,
    timesteps,
    grid: {
      rows: ZARR_GLOBAL_GRID.rows,
      cols: ZARR_GLOBAL_GRID.cols,
      bounds: ZARR_GLOBAL_GRID.bounds,
    },
    isWarm,
    cachedFramesCount: frameCache.size,
  };
}

/**
 * Menghangatkan seluruh frame sebaran asap ke dalam memori cache server.
 * Dipanggil oleh cron job background atau script pre-warm.
 */
export async function hangatkanSemuaFrame(
  onProgress?: (selesai: number, total: number) => void,
  forceRefresh: boolean = true
): Promise<{
  total: number;
  berhasil: number;
  gagal: number;
  durasiMs: number;
  isWarm: boolean;
}> {
  const mulai = Date.now();
  const meta = await getZarrMetadata(forceRefresh);
  const total = meta.timesteps.length;
  let berhasil = 0;
  let gagal = 0;
  let next = 0;
  const CONCURRENCY = 5;

  const worker = async () => {
    while (next < total) {
      const idx = next++;
      const stepMeta = meta.timesteps[idx];
      if (stepMeta) {
        try {
          await getZarrFrame(stepMeta.timeChunk, stepMeta.step, stepMeta.timeInner);
          berhasil++;
          onProgress?.(berhasil + gagal, total);
        } catch (e) {
          console.error(`[ZarrReader Pre-warm] Gagal mengunduh frame idx=${idx}:`, e);
          gagal++;
          onProgress?.(berhasil + gagal, total);
        }
      }
    }
  };

  const workers = Array.from(
    { length: Math.min(CONCURRENCY, total) },
    () => worker()
  );
  await Promise.all(workers);

  return {
    total,
    berhasil,
    gagal,
    durasiMs: Date.now() - mulai,
    isWarm: frameCache.size >= Math.floor(total * 0.7),
  };
}

