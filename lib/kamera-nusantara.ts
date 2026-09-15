/**
 * Kamera awal "seluruh Nusantara" konsol /peta — dipakai bersama lapisan
 * Aerosol (PetaAsap, MapLibre) dan lapisan Windy (iframe) supaya keduanya
 * membuka dengan komposisi yang sama. Sengaja modul tanpa dependensi peta:
 * peta.tsx memuatnya tanpa ikut menarik maplibre-gl ke bundelnya.
 */

/** Batas Nusantara Sabang–Merauke dengan sedikit napas di tiap sisi. */
export const BATAS_NUSANTARA: [[number, number], [number, number]] = [
  [94.5, -11.5],
  [141.5, 6.5],
];

/** Ruang di sekeliling Nusantara saat memuatnya. Di bingkai lebar ia
 *  proporsional terhadap ukuran bingkai supaya komposisinya sama di layar
 *  mana pun: Nusantara ~54% lebar, bergeser ke kiri-atas, menyisakan daratan
 *  Asia Tenggara di atas dan Australia di bawah sebagai konteks gerak asap
 *  (kanan & bawah lebih lega karena legenda dan bilah waktu ada di sana).
 *  Di bingkai sempit (ponsel) ruang tetap: pil mode di atas, bilah waktu di
 *  bawah — sela proporsional di sana membuat Nusantara terlalu kecil. */
export function selaNusantara(wadah: { clientWidth: number; clientHeight: number }) {
  const { clientWidth: w } = wadah;
  // Laci konsol ponsel menutup dasar bingkai setinggi --sela-bawah; Nusantara
  // dimuat di sisa bingkai di atasnya.
  const laci = selaBawah(wadah);
  const h = Math.max(0, wadah.clientHeight - laci);
  if (w < 640) return { top: 70, bottom: 120 + laci, left: 24, right: 24 };
  return {
    top: Math.round(h * 0.3),
    bottom: Math.round(h * 0.34) + laci,
    left: Math.round(w * 0.17),
    right: Math.round(w * 0.29),
  };
}

/** Tinggi laci konsol ponsel (px) dari variabel CSS --sela-bawah pada wadah
 *  atau leluhurnya; 0 di luar peramban atau bila tak diset (panggung). */
function selaBawah(wadah: object): number {
  if (typeof window === "undefined" || !(wadah instanceof Element)) return 0;
  return parseFloat(getComputedStyle(wadah).getPropertyValue("--sela-bawah")) || 0;
}
