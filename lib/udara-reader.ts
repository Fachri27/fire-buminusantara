import { redisGetBuffer, redisSetBuffer } from "./redis.ts";
import {
  CLEANUP_INTERVAL_MS,
  GalatHuluZarr,
  ZARR_GLOBAL_GRID,
  ambilChunkZarr,
  ambilKoordinatZarr,
  getZarrMetadata,
  type ZarrTimestepMeta,
} from "./zarr-reader.ts";

/**
 * Lapisan "Angin dan Kualitas Udara": AQI (dari PM2.5) + angin 10 m, dibaca
 * dari store CAMS ARCO yang sama dengan sebaran asap. Windy tidak punya
 * riwayat, sedangkan store ini memuat 7 hari analisis — jadi linimasanya bisa
 * mundur seminggu dan dianimasikan dengan pelebur frame yang sama.
 *
 * Satu frame = grid potong GRID_UDARA dalam tiga bidang berurutan: seluruh
 * byte aqi, lalu seluruh u, lalu seluruh v (cols*rows byte per bidang). Dalam
 * tiap bidang baris 0 = tepi selatan (naik ke utara), kolom 0 = tepi barat.
 * Per bidang, bukan [aqi, u, v] per titik: nilai bertetangga yang mirip jadi
 * berderet, dan brotli memampatkannya ~30% lebih kecil.
 */

/**
 * Wilayah potong: Indonesia + sekitarnya. Tepinya titik grid 0,4° ARCO yang
 * tepat. Cukup lebar untuk tampilan awal peta kecil beranda (zoom 2,5 ≈
 * 74°–174° BT, 27° LS–21° LU) dan layar penuh. 179,6° = kolom terakhir store
 * (tanpa melintasi garis tanggal). Di luar kotak ini peta memakai lapisan AQI
 * Windy sebagai latar.
 */
export const GRID_UDARA = {
  west: 60,
  south: -40,
  east: 179.6,
  north: 36,
  resolusi: 0.4,
  cols: 300, // (179,6 - 60) / 0,4 + 1
  rows: 191, // (36 - -40) / 0,4 + 1
} as const;

/** Skala byte: AQI 0..500 → 0..255; angin -40..40 m/s → 0..255. */
export const ENKODE_UDARA = { aqiMaks: 500, anginMin: -40, anginMaks: 40 } as const;

export const BYTE_PER_FRAME_UDARA = GRID_UDARA.cols * GRID_UDARA.rows * 3; // 171.900

/** Byte angin untuk data kosong: 128 ≈ 0 m/s, jadi titik kosong tampak tenang, bukan badai. */
export const BYTE_ANGIN_KOSONG = 128;

export interface UdaraMetadataResponse {
  latestModelRunIso: string;
  latestModelRunWib: string;
  timesteps: ZarrTimestepMeta[];
  grid: typeof GRID_UDARA;
  enkode: typeof ENKODE_UDARA;
}

/**
 * Nilai yang boleh dipakai. Selain NaN (fill_value store), GRIB menandai data
 * hilang dengan FLT_MAX (3,4e38) — terhingga, jadi Number.isFinite saja tidak
 * cukup menyaringnya.
 */
function adalahNilaiSah(x: number): boolean {
  return Number.isFinite(x) && Math.abs(x) < 1e30;
}

/**
 * Titik patah AQI US EPA (revisi 2024) untuk PM2.5 µg/m³:
 * [C_bawah, C_atas, I_bawah, I_atas]. Disambung tanpa celah (9,0 lalu 9,0,
 * bukan 9,0 lalu 9,1): tabel resmi berjenjang 0,1 karena konsentrasi
 * pemantau dipotong ke satu desimal, sedangkan keluaran model kontinu — celah
 * itu akan menyisakan nilai tanpa AQI.
 */
const TITIK_PATAH_AQI_PM25 = [
  [0, 9.0, 0, 50],
  [9.0, 35.4, 50, 100],
  [35.4, 55.4, 100, 150],
  [55.4, 125.4, 150, 200],
  [125.4, 225.4, 200, 300],
  [225.4, 325.4, 300, 500],
] as const;

/** AQI (0..500, kontinu) dari PM2.5 µg/m³. NaN bila masukan bukan nilai sah. */
export function aqiDariPm25(pm25: number): number {
  if (!adalahNilaiSah(pm25)) return NaN;
  if (pm25 <= 0) return 0;
  for (const [cBawah, cAtas, iBawah, iAtas] of TITIK_PATAH_AQI_PM25) {
    if (pm25 <= cAtas) return iBawah + ((pm25 - cBawah) * (iAtas - iBawah)) / (cAtas - cBawah);
  }
  return ENKODE_UDARA.aqiMaks;
}

/** AQI → byte 0..255 (dipotong ke 0..500). NaN → 0. */
export function byteAqi(aqi: number): number {
  if (!Number.isFinite(aqi)) return 0;
  const { aqiMaks } = ENKODE_UDARA;
  return Math.round((Math.min(Math.max(aqi, 0), aqiMaks) / aqiMaks) * 255);
}

/** Komponen angin m/s → byte 0..255 (dipotong ke -40..40). Kosong → 128. */
export function byteAngin(ms: number): number {
  if (!adalahNilaiSah(ms)) return BYTE_ANGIN_KOSONG;
  const { anginMin, anginMaks } = ENKODE_UDARA;
  return Math.round(Math.min(Math.max((ms - anginMin) / (anginMaks - anginMin), 0), 1) * 255);
}

/** baris[r] / kolom[c] = indeks lintang / bujur di grid sumber untuk baris r / kolom c keluaran. */
export interface IndeksGridUdara {
  baris: Int32Array;
  kolom: Int32Array;
}

/**
 * Memetakan grid potong ke indeks grid sumber memakai array koordinat store
 * itu sendiri, bukan rumus offset tetap: atribut GRIB di store menyebut
 * urutan yang berbeda dari datanya (lihat ZARR_GLOBAL_GRID), jadi hanya
 * koordinat yang bisa dipercaya. Bujur dibandingkan modulo 360 sehingga
 * konvensi 0..360 maupun -180..180 sama-sama benar. Melempar bila ada titik
 * yang tidak jatuh tepat di grid — lebih baik gagal daripada diam-diam bergeser.
 */
export function bangunIndeksGridUdara(lintang: ArrayLike<number>, bujur: ArrayLike<number>): IndeksGridUdara {
  const { south, west, resolusi, rows, cols } = GRID_UDARA;
  const toleransi = resolusi / 100;

  const cari = (koordinat: ArrayLike<number>, target: number, adalahBujur: boolean): number => {
    let terbaik = -1;
    let selisihTerbaik = Infinity;
    for (let i = 0; i < koordinat.length; i++) {
      let selisih = koordinat[i] - target;
      if (adalahBujur) selisih = ((((selisih % 360) + 540) % 360) - 180);
      selisih = Math.abs(selisih);
      if (selisih < selisihTerbaik) {
        selisihTerbaik = selisih;
        terbaik = i;
      }
    }
    if (!(selisihTerbaik <= toleransi)) {
      throw new GalatHuluZarr(
        `Grid Zarr tidak memuat ${adalahBujur ? "bujur" : "lintang"} ${target}° (terdekat meleset ${selisihTerbaik}°)`
      );
    }
    return terbaik;
  };

  const baris = new Int32Array(rows);
  for (let r = 0; r < rows; r++) baris[r] = cari(lintang, south + r * resolusi, false);
  const kolom = new Int32Array(cols);
  for (let c = 0; c < cols; c++) kolom[c] = cari(bujur, west + c * resolusi, true);
  return { baris, kolom };
}

/**
 * Memotong satu irisan waktu dari chunk pm2p5/u10/v10 (grid global, urutan C)
 * lalu mengemasnya jadi tiga bidang aqi | u | v. `offset` = awal irisan
 * timeInner di dalam chunk. `lengkap` = ketiga variabel punya data sah —
 * irisan run yang belum ditulis ECMWF berisi NaN seluruhnya dan tidak boleh
 * masuk cache.
 */
export function kemasFrameUdara(
  pm25KgM3: ArrayLike<number>,
  u10: ArrayLike<number>,
  v10: ArrayLike<number>,
  offset: number,
  indeks: IndeksGridUdara,
  kolomSumber: number = ZARR_GLOBAL_GRID.cols
): { buffer: Uint8Array; lengkap: boolean } {
  const { rows, cols } = GRID_UDARA;
  const n = rows * cols;
  const keluaran = new Uint8Array(n * 3);
  let sahPm = 0;
  let sahU = 0;
  let sahV = 0;
  let o = 0;

  for (let r = 0; r < rows; r++) {
    const awalBaris = offset + indeks.baris[r] * kolomSumber;
    for (let c = 0; c < cols; c++) {
      const i = awalBaris + indeks.kolom[c];
      const pm = pm25KgM3[i];
      const u = u10[i];
      const v = v10[i];
      if (adalahNilaiSah(pm)) sahPm++;
      if (adalahNilaiSah(u)) sahU++;
      if (adalahNilaiSah(v)) sahV++;
      // kg m⁻³ → µg m⁻³
      keluaran[o] = byteAqi(aqiDariPm25(pm * 1e9));
      keluaran[n + o] = byteAngin(u);
      keluaran[2 * n + o] = byteAngin(v);
      o++;
    }
  }

  return { buffer: keluaran, lengkap: sahPm > 0 && sahU > 0 && sahV > 0 };
}

// ── Cache ─────────────────────────────────────────────────────────────────
// Kebijakan umur sama dengan frame sebaran asap (L1 4 jam, Redis 24 jam).
// Kunci (timeChunk, step, timeInner) menunjuk satu run + satu step tertentu,
// dan isinya tidak berubah setelah ditulis; run baru = kunci baru.

export const MAKS_ENTRI_CACHE_UDARA = 200; // ~172 KB per frame → ±34 MB RAM
const UMUR_L1_MS = 4 * 3600 * 1000;
/**
 * Frame kosong (run belum ditulis ECMWF) disimpan sebentar di L1 saja: cukup
 * supaya setiap pemuatan peta selama jeda ingest tidak memicu 3 unduhan ~1 MB
 * per frame, tapi pendek agar data aslinya segera tampil begitu tiba.
 */
const UMUR_L1_KOSONG_MS = 5 * 60 * 1000;
const TTL_REDIS_DETIK = 24 * 3600;

const cacheFrameUdara = new Map<string, { buffer: Uint8Array; lengkap: boolean; expiresAt: number }>();
/** Unduhan chunk yang sedang berjalan, per (timeChunk, step) — dipakai bersama kedua timeInner. */
const sedangDiunduh = new Map<string, Promise<{ buffer: Uint8Array; lengkap: boolean }[]>>();
/**
 * Chunk yang dijawab 404 oleh ECMWF (belum/tak pernah ditulis), per
 * (timeChunk, step): galatnya diulang selama UMUR_L1_KOSONG_MS tanpa tiga
 * unduhan baru tiap permintaan. Kuncinya dibatasi linimasa oleh rute.
 */
const chunk404 = new Map<string, { galat: GalatHuluZarr; expiresAt: number }>();
let janjiIndeksGrid: Promise<IndeksGridUdara> | null = null;
let pembersihanTerakhir = Date.now();

const kunciL1 = (timeChunk: number, step: number, timeInner: number) => `udara:${timeChunk}_${step}_${timeInner}`;
// Versi kunci: naikkan bila enkode frame berubah, supaya Redis tidak menyajikan
// format lama (v2: wilayah diperlebar + tata per bidang).
const kunciRedis = (timeChunk: number, step: number, timeInner: number) =>
  `cams:udara:v2:frame:${timeChunk}:${step}:${timeInner}`;

function bersihkanCacheUdaraKedaluwarsa(sekarang: number): void {
  for (const [kunci, entri] of cacheFrameUdara.entries()) {
    if (entri.expiresAt <= sekarang) cacheFrameUdara.delete(kunci);
  }
  for (const [kunci, entri] of chunk404.entries()) {
    if (entri.expiresAt <= sekarang) chunk404.delete(kunci);
  }
}

function simpanL1(kunci: string, buffer: Uint8Array, lengkap: boolean, sekarang: number): void {
  cacheFrameUdara.delete(kunci); // set ulang → pindah ke ujung antrean FIFO
  if (cacheFrameUdara.size >= MAKS_ENTRI_CACHE_UDARA) {
    bersihkanCacheUdaraKedaluwarsa(sekarang);
    while (cacheFrameUdara.size >= MAKS_ENTRI_CACHE_UDARA) {
      const tertua = cacheFrameUdara.keys().next().value;
      if (tertua === undefined) break;
      cacheFrameUdara.delete(tertua);
    }
  }
  cacheFrameUdara.set(kunci, { buffer, lengkap, expiresAt: sekarang + (lengkap ? UMUR_L1_MS : UMUR_L1_KOSONG_MS) });
}

/** Indeks grid dimuat sekali per proses (koordinat store tidak berubah); gagal → dicoba lagi berikutnya. */
function muatIndeksGrid(): Promise<IndeksGridUdara> {
  if (!janjiIndeksGrid) {
    janjiIndeksGrid = Promise.all([ambilKoordinatZarr("latitude"), ambilKoordinatZarr("longitude")])
      .then(([lintang, bujur]) => bangunIndeksGridUdara(lintang, bujur))
      .catch((e) => {
        janjiIndeksGrid = null;
        throw e;
      });
  }
  return janjiIndeksGrid;
}

/**
 * Unduh pm2p5 + u10 + v10 (paralel) untuk satu (timeChunk, step) dan kemas
 * KEDUA timeInner sekaligus. Run analisis berpasangan berbagi chunk yang
 * sama, jadi frame pasangannya ikut tersimpan tanpa tiga unduhan ~1 MB lagi.
 */
async function unduhDanKemasChunk(timeChunk: number, step: number) {
  // pm10 sengaja tidak diambil: AQI cukup dari PM2.5, dan tiap variabel
  // berarti satu unduhan chunk ~1 MB lagi per frame.
  const [indeks, pm, u, v] = await Promise.all([
    muatIndeksGrid(),
    ambilChunkZarr("pm2p5", timeChunk, step),
    ambilChunkZarr("u10", timeChunk, step),
    ambilChunkZarr("v10", timeChunk, step),
  ]);
  const sekarang = Date.now();
  const hasil = [0, 1].map((timeInner) =>
    kemasFrameUdara(pm, u, v, timeInner * ZARR_GLOBAL_GRID.totalPoints, indeks)
  );
  hasil.forEach(({ buffer, lengkap }, timeInner) => {
    // Irisan kosong = run yang belum ditulis ECMWF (mis. pasangan run
    // terbaru). Hanya L1 berumur pendek, tidak ke Redis: begitu run itu
    // tiba, frame aslinya harus diambil, bukan frame kosong selama 4–24 jam.
    simpanL1(kunciL1(timeChunk, step, timeInner), buffer, lengkap, sekarang);
    if (!lengkap) return;
    redisSetBuffer(kunciRedis(timeChunk, step, timeInner), buffer, TTL_REDIS_DETIK).catch(() => {});
  });
  return hasil;
}

/**
 * Frame udara (BYTE_PER_FRAME_UDARA byte) untuk satu timestep. `lengkap`
 * false = data run itu belum tersedia (semua titik kosong); rute
 * menyajikannya tanpa cache HTTP.
 */
export async function getUdaraFrame(
  timeChunk: number,
  step: number,
  timeInner: number = 0
): Promise<{ buffer: Uint8Array; lengkap: boolean }> {
  if (timeInner !== 0 && timeInner !== 1) {
    throw new RangeError(`timeInner harus 0 atau 1, bukan ${timeInner}`);
  }
  const sekarang = Date.now();
  if (sekarang - pembersihanTerakhir > CLEANUP_INTERVAL_MS) {
    pembersihanTerakhir = sekarang;
    bersihkanCacheUdaraKedaluwarsa(sekarang);
  }

  // 1. L1 RAM proses
  const kunci = kunciL1(timeChunk, step, timeInner);
  const entri = cacheFrameUdara.get(kunci);
  if (entri && entri.expiresAt > sekarang) return { buffer: entri.buffer, lengkap: entri.lengkap };

  // 2. L2 Redis (lintas instance / restart)
  const dariRedis = await redisGetBuffer(kunciRedis(timeChunk, step, timeInner));
  if (dariRedis && dariRedis.byteLength === BYTE_PER_FRAME_UDARA) {
    const buffer = new Uint8Array(dariRedis.buffer, dariRedis.byteOffset, dariRedis.byteLength);
    simpanL1(kunci, buffer, true, sekarang);
    return { buffer, lengkap: true };
  }

  // 3. ECMWF — permintaan serentak untuk chunk yang sama menunggu satu unduhan
  const kunciChunk = `${timeChunk}_${step}`;
  const tak404 = chunk404.get(kunciChunk);
  if (tak404 && tak404.expiresAt > sekarang) throw tak404.galat;
  let janji = sedangDiunduh.get(kunciChunk);
  if (!janji) {
    janji = unduhDanKemasChunk(timeChunk, step)
      .catch((e: unknown) => {
        if (e instanceof GalatHuluZarr && e.status === 404) {
          chunk404.set(kunciChunk, { galat: e, expiresAt: Date.now() + UMUR_L1_KOSONG_MS });
        }
        throw e;
      })
      .finally(() => sedangDiunduh.delete(kunciChunk));
    sedangDiunduh.set(kunciChunk, janji);
  }
  return (await janji)[timeInner];
}

/** Metadata = linimasa sebaran asap apa adanya (frame index sama persis) + grid & enkode udara. */
export async function getUdaraMetadata(forceRefresh: boolean = false): Promise<UdaraMetadataResponse> {
  const meta = await getZarrMetadata(forceRefresh);
  return {
    latestModelRunIso: meta.latestModelRunIso,
    latestModelRunWib: meta.latestModelRunWib ?? "",
    timesteps: meta.timesteps,
    grid: GRID_UDARA,
    enkode: ENKODE_UDARA,
  };
}

/**
 * Menghangatkan seluruh frame udara ke cache (dipanggil cron warm-asap).
 * Tanpa ini pemuatan pertama butuh 3 unduhan chunk ECMWF per frame.
 */
export async function hangatkanSemuaFrameUdara(
  onProgress?: (selesai: number, total: number) => void,
  forceRefresh: boolean = true
): Promise<{ total: number; berhasil: number; gagal: number; durasiMs: number; isWarm: boolean }> {
  const mulai = Date.now();
  const meta = await getZarrMetadata(forceRefresh);
  const total = meta.timesteps.length;
  let berhasil = 0;
  let gagal = 0;
  let next = 0;
  // 2 frame paralel = paling banyak 6 unduhan ECMWF serentak (3 variabel per
  // frame), setara 5 milik hangatkanSemuaFrame. Urutan linimasa membuat run
  // pasangan (timeInner 1) jatuh setelah pasangannya, jadi biasanya tinggal hit cache.
  const KONKURENSI = 2;

  const worker = async () => {
    while (next < total) {
      const idx = next++;
      const langkah = meta.timesteps[idx];
      if (!langkah) continue;
      try {
        await getUdaraFrame(langkah.timeChunk, langkah.step, langkah.timeInner);
        berhasil++;
      } catch (e) {
        console.error(`[UdaraReader Pre-warm] Gagal mengunduh frame idx=${idx}:`, e);
        gagal++;
      }
      onProgress?.(berhasil + gagal, total);
    }
  };

  await Promise.all(Array.from({ length: Math.min(KONKURENSI, total) }, () => worker()));

  return {
    total,
    berhasil,
    gagal,
    durasiMs: Date.now() - mulai,
    isWarm: berhasil >= Math.floor(total * 0.7),
  };
}
