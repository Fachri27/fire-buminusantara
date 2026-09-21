/** Kunci, label, dan bawaan enam angka sorotan — TANPA impor prisma supaya
 *  boleh dipakai komponen klien. Akses basis data ada di statistik-sorotan.ts. */

/** Enam angka kartu statistik landing karhutla, sesuai urutan tampil. */
export const KUNCI_SOROTAN = [
  "hotspot",
  "api_aktif",
  "lahan_terbakar",
  "korban_ispa",
  "rugi_ekonomi",
  "korban_satwa",
] as const;

export type KunciSorotan = (typeof KUNCI_SOROTAN)[number];

/** Label kartu per bahasa — dipakai landing maupun form CMS. */
export const LABEL_SOROTAN: Record<KunciSorotan, { id: string; en: string }> = {
  hotspot: { id: "Berapa jumlah hotspot", en: "How many hotspots" },
  api_aktif: { id: "Berapa aktif api", en: "How many active fires" },
  lahan_terbakar: { id: "Berapa lahan terbakar", en: "How much land burned" },
  korban_ispa: { id: "Berapa korban ispa", en: "How many ARI cases" },
  rugi_ekonomi: { id: "Berapa kerugian ekonomi", en: "How much economic loss" },
  korban_satwa: { id: "Berapa korban satwa", en: "How much wildlife affected" },
};

/** Bawaan bila tabel masih kosong — sama dengan mockup (5.000). */
export const BAWAN_SOROTAN: Record<KunciSorotan, number> = {
  hotspot: 5000,
  api_aktif: 5000,
  lahan_terbakar: 5000,
  korban_ispa: 5000,
  rugi_ekonomi: 5000,
  korban_satwa: 5000,
};
