/** Identitas situs untuk metadata (title, og, twitter, JSON-LD, sitemap). */
export const NAMA_SITUS = "LAPORIN";
export const JUDUL_SITUS = "LAPORIN - Kebakaran Hutan & Lahan";
export const DESKRIPSI_SITUS =
  "Menyaksikan kebakaran hutan dan lahan? Asap? Atau hal-hal terkait seperti kekeringan? Kabarkan di sini.";
/** Akar absolut situs; env supaya instance staging bisa menimpanya. */
export const URL_SITUS = (process.env.NEXT_PUBLIC_SITE_URL || "https://laporin.app").replace(/\/$/, "");
