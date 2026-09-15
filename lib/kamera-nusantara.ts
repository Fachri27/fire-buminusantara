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
  const { clientWidth: w, clientHeight: h } = wadah;
  if (w < 640) return { top: 70, bottom: 120, left: 24, right: 24 };
  return {
    top: Math.round(h * 0.3),
    bottom: Math.round(h * 0.34),
    left: Math.round(w * 0.17),
    right: Math.round(w * 0.29),
  };
}
