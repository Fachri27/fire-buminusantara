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

/** Ruang di sekeliling Nusantara saat memuatnya.
 *  - Di mode selayar (isPenuh): Nusantara dibentangkan dinamis memenuhi layar
 *    dengan sela minimal di sekeliling kontrol (pil atas, bilah waktu bawah, zoom kanan).
 *  - Di bingkai lebar biasa: proporsional terhadap ukuran bingkai supaya komposisinya
 *    sama di layar mana pun (~54% lebar, bergeser ke kiri-atas).
 *  - Di bingkai sempit (ponsel) biasa: ruang tetap dengan sela laci bawah. */
export function selaNusantara(
  wadah: { clientWidth: number; clientHeight: number },
  isPenuh?: boolean,
) {
  const { clientWidth: w, clientHeight: hRaw } = wadah;
  const penuh =
    isPenuh ??
    (typeof window !== "undefined" &&
      ((wadah instanceof Element &&
        (wadah.closest("#lk-peta-selayar") !== null ||
          wadah.classList.contains("lk-peta-penuh") ||
          wadah.closest(".lk-peta-penuh") !== null)) ||
        (Math.abs(w - window.innerWidth) < 10 &&
          Math.abs(hRaw - window.innerHeight) < 10)));

  const laci = penuh ? 0 : selaBawah(wadah);
  const h = Math.max(0, hRaw - laci);

  if (penuh) {
    if (w < 640) {
      return { top: 90, bottom: 110, left: 24, right: 24 };
    }
    // Sela penuh selayar: proporsional terhadap bingkai supaya Nusantara
    // duduk lega di layar mana pun — bukan menempel ke tepi. Nilai lantai
    // menjaga jarak dari kontrol (pil atas, bilah waktu bawah, zoom kanan).
    // Sela mendatar yang mengikat: batas Sabang–Merauke 47° dibagi lebar
    // efektif. Dengan 0.03/0.04 yang lama itu ~38px/derajat di 1080p —
    // Nusantara menempel tepi dan terasa terlalu dekat; 0.16/0.18 membawanya
    // ke ~27px/derajat, sebanding komposisi bingkai kecil.
    return {
      top: Math.max(96, Math.round(h * 0.16)),
      bottom: Math.max(112, Math.round(h * 0.18)),
      left: Math.max(96, Math.round(w * 0.16)),
      right: Math.max(112, Math.round(w * 0.18)),
    };
  }

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
