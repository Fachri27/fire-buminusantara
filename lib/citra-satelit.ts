/**
 * Citra peta dasar (Sentinel-2 cloudless 2024, EOX) lewat /api/citra/{z}/{y}/{x}.
 *
 * Server EOX di Austria: dari Indonesia sambungan TLS-nya saja 3–14 dtk dan sebagian ubin habis
 * waktu, jadi peta situs & aplikasi lama sekali hitam. Ubin diambil sekali dari EOX lalu disimpan
 * di MinIO; berikutnya dilayani dari server sendiri.
 */

export const ZOOM_MAKS_CITRA = 14;

const HULU = "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g";

export type Ubin = { z: number; y: number; x: number };

/** Ubin sah = bilangan bulat di dalam kisi zoom-nya; selain itu null, tak pernah sampai ke EOX/MinIO. */
export function bacaUbin(z: string, y: string, x: string): Ubin | null {
  if (![z, y, x].every((s) => /^\d{1,5}$/.test(s))) return null;
  const u = { z: Number(z), y: Number(y), x: Number(x) };
  const n = 2 ** u.z;
  return u.z <= ZOOM_MAKS_CITRA && u.y < n && u.x < n ? u : null;
}

export const urlHulu = (u: Ubin) => `${HULU}/${u.z}/${u.y}/${u.x}.jpeg`;

/** Di luar awalan media publik (kunciMediaPublik), jadi tak terbaca lewat /media. */
export const kunciCitra = (u: Ubin) => `citra/s2cloudless-2024/${u.z}/${u.y}/${u.x}.jpeg`;
