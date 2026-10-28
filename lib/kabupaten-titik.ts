import { pencariFitur, poligonFitur, tempatAngka, type Geometri } from "./geometri.ts";
import { provinsiDariTitik } from "./provinsi-titik.ts";
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
const fitur = (petaKabupaten as { features: { properties: { nama: string }; geometry: Geometri }[] }).features.map((f) => ({
  nama: f.properties.nama,
  geometri: f.geometry,
}));
const cariKabupaten = pencariFitur(fitur);
// Nama kabupaten unik (515 fitur, tanpa kembar).
const geometriKabupaten = new Map(fitur.map((f) => [f.nama, f.geometri]));
const provinsiTembolok = new Map<string, string | null>();

export function kabupatenDariTitik(lat: number, lng: number): string | null {
  return cariKabupaten(lng, lat);
}

/**
 * Provinsi kabupaten `nama` — untuk titik pesisir & pulau kecil yang meleset
 * dari poligon provinsi (7,5 ribu simpul untuk 34 provinsi, jauh lebih kasar
 * dari poligon kabupaten). Dari titik dalam daratan terbesarnya, lalu pulau
 * lainnya: daratan terbesar Sikka, Lombok Barat, dll. pun meleset. null untuk
 * Kep. Seribu — poligon DKI Jakarta sama sekali tak memuatnya.
 */
export function provinsiDariKabupaten(nama: string): string | null {
  if (provinsiTembolok.has(nama)) return provinsiTembolok.get(nama)!;
  const g = geometriKabupaten.get(nama);
  let provinsi: string | null = null;
  for (const bagian of g ? [g, ...poligonFitur(g).map((coordinates) => ({ type: "Polygon", coordinates }))] : []) {
    const t = tempatAngka(bagian);
    provinsi = t && provinsiDariTitik(t.titik[1], t.titik[0]);
    if (provinsi) break;
  }
  provinsiTembolok.set(nama, provinsi);
  return provinsi;
}
