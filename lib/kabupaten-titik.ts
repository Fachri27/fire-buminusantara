import { pencariFitur, type Geometri } from "./geometri.ts";
// Relatif + atribut JSON supaya bisa diuji lewat node:test mentah, sama
// dengan provinsi-titik.ts.
import petaKabupaten from "./peta-kabupaten.json" with { type: "json" };

/**
 * Kabupaten/kota yang poligonnya menaungi titik — untuk peringkat hotspot per
 * kabupaten (lib/hotspot-firms.ts). Khusus server: 7,6 MB poligon jangan
 * masuk bundel klien.
 *
 * lib/peta-kabupaten.json = layer proteus:KABUPATEN_STADI_2025 GeoServer
 * Simontini (515 kabupaten/kota, nama = level_4), disederhanakan sekali:
 *   mapshaper kab.json -filter-fields level_4 -rename-fields nama=level_4 \
 *     -simplify interval=100 keep-shapes -clean -o precision=0.0001
 * Toleransi 100 m, di bawah piksel VIIRS 375 m: dari 20 ribu titik darat
 * acak, 99,91% berkabupaten sama dengan poligon asli GeoServer (360 MB; 600 m
 * dulu 99,17%), dan pencariannya ±30× lebih cepat.
 */
const cariKabupaten = pencariFitur(
  (petaKabupaten as { features: { properties: { nama: string }; geometry: Geometri }[] }).features.map((f) => ({
    nama: f.properties.nama,
    geometri: f.geometry,
  })),
);

export function kabupatenDariTitik(lat: number, lng: number): string | null {
  return cariKabupaten(lng, lat);
}
