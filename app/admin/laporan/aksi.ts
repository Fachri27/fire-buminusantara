"use server";

import { redirect } from "next/navigation";
import { bacaSesi, bolehKelola } from "@/lib/sesi";
import { aturStatusLaporan, hapusLaporan, aturOrientasiLaporan, type StatusLaporan } from "@/lib/laporan-publik";
import type { Orientasi } from "@/lib/media";

/** Server action terbuka lewat POST langsung, bukan cuma lewat tombol di CMS —
 *  jadi sesinya diperiksa di dalam setiap aksi, bukan sekali di halamannya. */
async function jaga() {
  const sesi = await bacaSesi();
  if (!sesi || !bolehKelola(sesi.peran)) redirect("/admin/login");
  return sesi;
}

/** Putuskan satu laporan: terverifikasi, ditolak, atau dikembalikan ke antrean.
 *  Mengembalikan hasilnya supaya antarmuka bisa menampilkan kegagalan (mis.
 *  kalau laporan terverifikasi gagal naik menjadi kejadian). */
export async function aksiStatus(id: number, status: StatusLaporan) {
  const sesi = await jaga();
  return aturStatusLaporan(id, status, sesi.id);
}

/** Buang laporan beserta lampirannya. Seperti komentar: meninjau boleh editor,
 *  membuang hanya admin. */
export async function aksiHapusLaporan(id: number) {
  const sesi = await jaga();
  if (sesi.peran !== "admin") redirect("/admin/laporan");
  await hapusLaporan(id);
  return { ok: true as const };
}

/** Simpan pilihan orientasi (potret/lanskap) sebuah lampiran saat diverifikasi.
 *  Boleh editor maupun admin — meninjau berarti juga menandai orientasinya. */
export async function aksiOrientasi(id: number, url: string, orientasi: Orientasi) {
  await jaga();
  return aturOrientasiLaporan(id, url, orientasi);
}
