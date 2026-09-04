/**
 * Layanan peta Simontini.
 *
 * Choropleth per PROVINSI. Layer kabupaten (KABUPATEN_STADI_2025) masih ada di
 * GeoServer yang sama; kalau suatu saat dikembalikan ke sana, yang berubah
 * bukan cuma nama layer — atributnya berbeda: kabupaten memakai level_4 (nama)
 * + luas, provinsi memakai level_3 (nama) + deforestas.
 */
import { cacheLife } from "next/cache";

export const WMS_URL = "https://aws.simontini.id/geoserver/wms";
export const WFS_URL = "https://aws.simontini.id/geoserver/wfs";
export const WMS_LAYER = "proteus:PROVINSI_STADI_2025";

export const BIDANG_NAMA = "level_3";
export const BIDANG_PULAU = "level_2";
export const BIDANG_LUAS = "deforestas";

/** Kotak pembatas Indonesia — dipakai mengepaskan peta ke wadahnya. */
export const BATAS: [[number, number], [number, number]] = [
  [-11.2, 94.7],
  [6.4, 141.3],
];

/** Sisi raster GetFeatureInfo berjendela sendiri. 256 sudah cukup halus untuk
 *  provinsi terkecil, dan lebih hemat daripada 512: yang membuat jawaban besar
 *  bukan resolusinya melainkan jumlah pulau. */
export const PIKSEL_QUERY = 256;

export type FiturWilayah = {
  properties: Record<string, string | number | null>;
  geometry: { type: string; coordinates: unknown };
};

/**
 * Identifikasi provinsi di sebuah titik.
 *
 * `derajat` mengganti bingkai peta yang sedang tampil dengan kotak sendiri
 * berpusat di titik itu. Perlu pada jalur pilih-lewat-nama: di ponsel peta cuma
 * ~150px untuk seluruh Indonesia, satu piksel query menutupi puluhan kilometer,
 * dan provinsi sekecil DKI Jakarta terjawab sebagai tetangganya.
 */
export async function getFeatureInfo(
  bingkai:
    | { jenis: "peta"; bbox: string; lebar: number; tinggi: number; x: number; y: number }
    | { jenis: "jendela"; lng: number; lat: number; derajat: number },
): Promise<FiturWilayah | null> {
  const p =
    bingkai.jenis === "jendela"
      ? (() => {
          const s = bingkai.derajat / 2;
          return {
            bbox: [bingkai.lng - s, bingkai.lat - s, bingkai.lng + s, bingkai.lat + s].join(","),
            width: String(PIKSEL_QUERY),
            height: String(PIKSEL_QUERY),
            x: String(Math.round(PIKSEL_QUERY / 2)),
            y: String(Math.round(PIKSEL_QUERY / 2)),
          };
        })()
      : {
          bbox: bingkai.bbox,
          width: String(bingkai.lebar),
          height: String(bingkai.tinggi),
          x: String(bingkai.x),
          y: String(bingkai.y),
        };

  const params = new URLSearchParams({
    service: "WMS", version: "1.1.0", request: "GetFeatureInfo",
    layers: WMS_LAYER, query_layers: WMS_LAYER,
    info_format: "application/json", feature_count: "1", srs: "EPSG:4326",
    ...p,
  });

  try {
    const r = await fetch(`${WMS_URL}?${params}`);
    const data = await r.json();
    return data?.features?.[0] ?? null;
  } catch {
    return null;
  }
}

/** Satu baris pada daftar "3 provinsi dengan kebakaran terluas". */
export type ProvinsiTeratas = {
  peringkat: number;
  nama: string;
  pulau: string;
  /** Sudah diformat id-ID; satuannya hektare, ditulis di komponennya. */
  luas: string;
};

/** Tiga provinsi dengan luas kebakaran terbesar. Urut menurun dengan null
 *  dikecualikan — tanpa filter itu server menaruh nilai kosong lebih dulu. */
/**
 * Pengambilan yang di-cache. SENGAJA tanpa try/catch: kalau GeoServer gagal,
 * galatnya harus lolos ke pemanggil supaya TIDAK ADA yang tersimpan. Menaruh
 * `catch { return [] }` di dalam sini berarti satu gangguan sesaat membekukan
 * daftar kosong selama sejam penuh.
 */
async function tigaTeratasTercache(): Promise<ProvinsiTeratas[]> {
  "use cache";
  // Dulu `next: { revalidate: 3600 }` pada fetch-nya. Di bawah Cache Components
  // opsi cache pada fetch pindah ke sini sebagai cacheLife; profil "hours"
  // adalah padanan terdekat satu jam. Angka luas kebakaran per provinsi
  // berubah paling cepat harian, jadi itu lebih dari cukup — dan tanpa cache
  // setiap kunjungan menunggu GeoServer.
  cacheLife("hours");

  const params = new URLSearchParams({
    service: "WFS", version: "1.1.0", request: "GetFeature",
    typeName: WMS_LAYER,
    propertyName: `${BIDANG_PULAU},${BIDANG_NAMA},${BIDANG_LUAS}`,
    sortBy: `${BIDANG_LUAS} D`,
    maxFeatures: "3",
    outputFormat: "application/json",
    CQL_FILTER: `${BIDANG_LUAS} IS NOT NULL`,
  });

  // Batas waktunya ada supaya layanan yang menggantung tidak ikut
  // menggantungkan render halaman — daftar kosong lebih baik.
  const r = await fetch(`${WFS_URL}?${params}`, {
    signal: AbortSignal.timeout(6000),
  });
  const data = await r.json();
  return (data?.features ?? []).map(
    (f: { properties: Record<string, string | number> }, i: number) => ({
      peringkat: i + 1,
      nama: String(f.properties[BIDANG_NAMA]),
      pulau: String(f.properties[BIDANG_PULAU]),
      luas: Math.round(Number(f.properties[BIDANG_LUAS])).toLocaleString("id-ID"),
    }),
  );
}

export async function ambilTigaTeratas(): Promise<ProvinsiTeratas[]> {
  try {
    return await tigaTeratasTercache();
  } catch {
    return [];
  }
}
