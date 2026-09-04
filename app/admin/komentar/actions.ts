"use server";

import { redirect } from "next/navigation";
import { updateTag } from "next/cache";
import { bacaSesi, bolehKelola } from "@/lib/sesi";
import { umumkanTunggakan } from "@/lib/loket-tunggakan";
import { aturPersetujuan, hapusKomentarModerasi } from "@/lib/moderasi-komentar";

async function jaga() {
  const sesi = await bacaSesi();
  if (!sesi || !bolehKelola(sesi.peran)) redirect("/admin/login");
  return sesi;
}

/** Ubah status persetujuan komentar (server action). */
export async function aksiSetujui(id: number, disetujui: boolean) {
  await jaga();
  await aturPersetujuan(id, disetujui);
  // Tanpa ini angka tunggakan komentar di menu hanya berubah setelah jendela
  // cache 15 detik + satu muat ulang basi (stale-while-revalidate).
  try {
    updateTag("tunggakan");
  } catch {}
  umumkanTunggakan();
}

/** Hapus komentar beserta balasan dan reaksinya (server action). */
export async function aksiHapus(id: number) {
  const sesi = await jaga();
  if (sesi.peran !== "admin") redirect("/admin/komentar");
  await hapusKomentarModerasi(id);
  try {
    updateTag("tunggakan");
  } catch {}
  umumkanTunggakan();
}