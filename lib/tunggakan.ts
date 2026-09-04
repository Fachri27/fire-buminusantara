import { prisma } from "./prisma";
import { hitungMenunggu } from "./laporan-publik";

/** Angka tunggakan per halaman CMS — yang dipakai lencana di menu. */
export type Tunggakan = { belumDitinjau: number; laporanMenunggu: number };

/**
 * Dua antrean yang harus dilihat peninjau: komentar yang belum disetujui dan
 * laporan warga yang belum diputuskan.
 *
 * SENGAJA tanpa cache: angka ini dibaca sebagai status antrean dan harus tepat
 * pada setiap render maupun setiap detak aliran. Dua COUNT kecil tidak ada
 * apa-apanya dibanding satu daftar — meng-cache-nya membuat lencana ngadat.
 */
export async function hitungTunggakan(): Promise<Tunggakan> {
  const [belumDitinjau, laporanMenunggu] = await Promise.all([
    prisma.comments.count({
      where: { commentable_type: "App\\Models\\Event", is_approved: false },
    }),
    hitungMenunggu(),
  ]);
  return { belumDitinjau, laporanMenunggu };
}
