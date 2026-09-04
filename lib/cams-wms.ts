/**
 * Layanan data CAMS (Copernicus Atmosphere Monitoring Service) via ECMWF WMS.
 *
 * Menyediakan konfigurasi layer Biomass Burning Aerosol Optical Depth (BBAOD),
 * styles visualisasi, dan generator linimasa prediksi per 3 jam.
 */

export const CAMS_WMS_URL = "https://eccharts.ecmwf.int/wms/?token=public";

export const CAMS_LAYERS = {
  BBAOD: "composition_bbaod550", // Total aerosol amount from wildfire emissions (Biomass burning AOD 550nm)
  TOTAL_AOD: "composition_aod550", // Total aerosol optical depth 550nm
  PM25: "composition_pm2p5", // PM2.5 particulate matter
} as const;

export type CamsLayerKey = keyof typeof CAMS_LAYERS;

export const CAMS_STYLES = {
  SPECTRAL: "sh_all_aod", // Spektrum multi-warna (Biru -> Hijau -> Kuning -> Jingga -> Merah -> Marun)
  ORANGES: "sh_Oranges_aod", // Gradasi api (Jingga muda -> Jingga menyala -> Merah bata)
  BUYLRD: "sh_BuYlRd_aod_lowthreshold", // Biru - Kuning - Merah ambang rendah
} as const;

export type CamsStyleKey = keyof typeof CAMS_STYLES;

export interface CamsTimeStep {
  iso: string; // ISO 8601 string, e.g. "2026-09-04T00:00:00Z"
  waktu: number; // Unix timestamp ms
  labelUtc: string; // e.g. "4 Sep, 00:00 UTC"
  labelWib: string; // e.g. "4 Sep, 07:00 WIB"
  adalahPrediksi: boolean; // True jika waktu > sekarang (Forecast/Prediksi)
}

/**
 * Menghasilkan daftar titik waktu CAMS per 3 jam.
 * Berisi 15 langkah temporal (-24 jam historis s.d. +18 jam prediksi),
 * yang pada durasi transisi 1.44 detik per langkah menghasilkan siklus loop penuh ~21.6 detik.
 */
export function ambilLinimasaCams(patokanWaktu: Date = new Date(), jumlahLangkah: number = 15): CamsTimeStep[] {
  const sekarang = patokanWaktu.getTime();
  const patokan = new Date(patokanWaktu);

  // Bulatkan ke interval 3 jam UTC terdekat
  const jam = patokan.getUTCHours();
  const jamBulat = Math.floor(jam / 3) * 3;
  patokan.setUTCHours(jamBulat, 0, 0, 0);

  // 8 langkah historis (-24 jam), 1 langkah observasi saat ini, 6 langkah prediksi (+18 jam)
  const awalMs = patokan.getTime() - 8 * 3 * 3600 * 1000;
  const hasil: CamsTimeStep[] = [];
  const namaBulan = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];

  for (let i = 0; i < jumlahLangkah; i++) {
    const curr = new Date(awalMs + i * 3 * 3600 * 1000);
    const iso = curr.toISOString().replace(/\.\d{3}Z$/, "Z");
    const waktu = curr.getTime();

    // UTC
    const tglUtc = curr.getUTCDate();
    const blnUtc = namaBulan[curr.getUTCMonth()];
    const jamUtc = String(curr.getUTCHours()).padStart(2, "0");
    const menitUtc = String(curr.getUTCMinutes()).padStart(2, "0");

    // WIB (UTC + 7 jam)
    const wib = new Date(waktu + 7 * 3600 * 1000);
    const tglWib = wib.getUTCDate();
    const blnWib = namaBulan[wib.getUTCMonth()];
    const jamWib = String(wib.getUTCHours()).padStart(2, "0");
    const menitWib = String(wib.getUTCMinutes()).padStart(2, "0");

    hasil.push({
      iso,
      waktu,
      labelUtc: `${tglUtc} ${blnUtc}, ${jamUtc}:${menitUtc} UTC`,
      labelWib: `${tglWib} ${blnWib}, ${jamWib}:${menitWib} WIB`,
      adalahPrediksi: waktu > sekarang,
    });
  }

  return hasil;
}

/**
 * Mencari indeks titik waktu yang paling mendekati waktu saat ini.
 */
export function cariIndeksTerdekat(linimasa: CamsTimeStep[], targetWaktu: Date = new Date()): number {
  if (!linimasa.length) return 0;
  const target = targetWaktu.getTime();
  let minDiff = Infinity;
  let indeksTerbaik = 0;

  for (let i = 0; i < linimasa.length; i++) {
    const diff = Math.abs(linimasa[i].waktu - target);
    if (diff < minDiff) {
      minDiff = diff;
      indeksTerbaik = i;
    }
  }

  return indeksTerbaik;
}

/**
 * Batas wilayah regional Asia Tenggara / Nusantara untuk layer WebGL CAMS.
 * Meliputi bentang koordinat 90°BT s.d. 145°BT dan 15°LS s.d. 15°LU.
 */
export const CAMS_REGION_BBOX_3857 = {
  minX: 10018754.17,
  minY: -1689200.14,
  maxX: 16141326.17,
  maxY: 1689200.14,
  width: 1280,
  height: 706,
} as const;

export const CAMS_REGION_BOUNDS_LATLNG: [[number, number], [number, number]] = [
  [-15.0, 90.0],
  [15.0, 145.0],
];

/**
 * Membangun URL WMS GetMap resolusi tinggi untuk satu frame regional CAMS BBAOD.
 */
export function buildCamsGetMapUrl(isoWaktu: string, style: string = "sh_Oranges_aod"): string {
  const { minX, minY, maxX, maxY, width, height } = CAMS_REGION_BBOX_3857;
  return `${CAMS_WMS_URL}&service=WMS&request=GetMap&layers=${CAMS_LAYERS.BBAOD}&styles=${style}&format=image/png&transparent=true&version=1.3.0&crs=EPSG:3857&bbox=${minX},${minY},${maxX},${maxY}&width=${width}&height=${height}&time=${isoWaktu}`;
}

/**
 * Pengaturan tampilan visualisasi sebaran asap (kalibrasi persis sesuai pilihan di Copernicus):
 * - Plot range: [0.00, 1.80]
 * - Opacity: 59% (0.59)
 * - Fade-in: 24% (0.24)
 */
export const SMOKE_DISPLAY_SETTINGS = {
  plotRangeMin: 0.0,
  plotRangeMax: 1.8,
  opacity: 0.59,
  fadeIn: 0.24,
} as const;
