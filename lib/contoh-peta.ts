import type { Berita } from "./events";
import type { ProvinsiTeratas } from "./wms";

/**
 * Data contoh untuk pratinjau /peta tanpa basis data (mis. deploy Vercel
 * coba-coba). Aktif kalau env PETA_DUMMY === "1" — lihat lib/events.ts.
 *
 * Bentuknya disengaja mirip data dev: 10 laporan di 6 provinsi (Jawa Barat
 * terbanyak supaya pop-up wilayah & pencarian terisi), lat/lng titik asli
 * (Bogor, Bandung, Pontianak, Palangka Raya, Pekanbaru, ...), media memakai
 * picsum.photos supaya kartu/galeri ikut terlihat tanpa MinIO.
 */

const FOTO = (id: number) => `https://picsum.photos/seed/karhutla-${id}/800/500`;

function laporan(
  id: number,
  judul: string,
  provinsi: string,
  pulau: string,
  lokasi: string,
  lat: number,
  lng: number,
  tanggal: string,
  seedFoto: number,
): Berita {
  const gambar = FOTO(seedFoto);
  return {
    id,
    slug: `contoh-${id}`,
    pulau,
    provinsi,
    tanggal,
    judul,
    gambar,
    alt: judul,
    video: null,
    poster: gambar,
    lokasi,
    lat,
    lng,
    deskripsi: `${judul} — data contoh untuk pratinjau tampilan.`,
    media: [{ jenis: "gambar", url: gambar, keterangan: judul }],
    vertikal: false,
  };
}

export const BERITA_CONTOH: Berita[] = [
  laporan(1, "Asap tebal di tepi jalan Trans-Kalimantan", "Kalimantan Barat", "Kalimantan", "Pontianak, Kalimantan Barat", -0.0263, 109.3425, "12 September 2026", 11),
  laporan(2, "Kebakaran lahan gambut di pinggir kota", "Kalimantan Tengah", "Kalimantan", "Palangka Raya, Kalimantan Tengah", -2.2161, 113.9139, "11 September 2026", 12),
  laporan(3, "Titik api terlihat dari permukiman warga", "Riau", "Sumatra", "Pekanbaru, Riau", 0.5071, 101.4478, "10 September 2026", 13),
  laporan(4, "Asap menyelimuti kebun sawit", "Jawa Barat", "Jawa", "Bogor, Jawa Barat", -6.5971, 106.806, "9 September 2026", 14),
  laporan(5, "Lahan kering terbakar dekat perumahan", "Jawa Barat", "Jawa", "Depok, Jawa Barat", -6.4025, 106.7942, "8 September 2026", 15),
  laporan(6, "Kepulan asap dari arah hutan lindung", "Jawa Barat", "Jawa", "Bandung, Jawa Barat", -6.9175, 107.6191, "7 September 2026", 16),
  laporan(7, "Rumput ilalang terbakar di bukit", "Jawa Timur", "Jawa", "Malang, Jawa Timur", -7.9666, 112.6326, "6 September 2026", 17),
  laporan(8, "Asap tipis di kawasan pesisir", "Banten", "Jawa", "Serang, Banten", -6.1167, 106.15, "5 September 2026", 18),
  laporan(9, "Lahan kosong terbakar di pinggir tol", "Jawa Barat", "Jawa", "Bekasi, Jawa Barat", -6.2383, 106.9756, "4 September 2026", 19),
  laporan(10, "Titik panas terpantau warga", "Sumatera Selatan", "Sumatra", "Palembang, Sumatera Selatan", -2.9909, 104.7565, "3 September 2026", 20),
];

export const TERBARU_CONTOH: Berita[] = BERITA_CONTOH.slice(0, 5);

export const POPULER_CONTOH: Berita[] = BERITA_CONTOH.slice(5, 10);

export const JUMLAH_CONTOH: Record<string, number> = {
  "Jawa Barat": 4,
  "Kalimantan Barat": 1,
  "Kalimantan Tengah": 1,
  Riau: 1,
  "Jawa Timur": 1,
  Banten: 1,
  "Sumatera Selatan": 1,
};

export const TERATAS_CONTOH: ProvinsiTeratas[] = [
  { peringkat: 1, nama: "Kalimantan Tengah", pulau: "Kalimantan", luas: "12.400" },
  { peringkat: 2, nama: "Riau", pulau: "Sumatra", luas: "8.150" },
  { peringkat: 3, nama: "Kalimantan Barat", pulau: "Kalimantan", luas: "5.320" },
];

/** true kalau deploy ini memakai data contoh (tanpa basis data). */
export function pakaiContoh(): boolean {
  return process.env.PETA_DUMMY === "1";
}
