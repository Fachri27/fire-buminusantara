"use server";

import { redirect } from "next/navigation";
import { bacaSesi, bolehKelola } from "@/lib/sesi";
import { aturStatusLaporan, hapusLaporan, type StatusLaporan } from "@/lib/laporan-publik";

/** Server action terbuka lewat POST langsung, bukan cuma lewat tombol di CMS —
 *  jadi sesinya diperiksa di dalam setiap aksi, bukan sekali di halamannya. */
async function jaga() {
  const sesi = await bacaSesi();
  if (!sesi || !bolehKelola(sesi.peran)) redirect("/admin/login");
  return sesi;
}

/** Putuskan satu laporan: terverifikasi, ditolak, atau dikembalikan ke antrean. */
export async function aksiStatus(id: number, status: StatusLaporan) {
  const sesi = await jaga();
  await aturStatusLaporan(id, status, sesi.id);
}

/** Buang laporan beserta lampirannya. Seperti komentar: meninjau boleh editor,
 *  membuang hanya admin. */
export async function aksiHapusLaporan(id: number) {
  const sesi = await jaga();
  if (sesi.peran !== "admin") redirect("/admin/laporan");
  await hapusLaporan(id);
}
