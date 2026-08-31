"use server";

import { redirect } from "next/navigation";
import { bacaSesi, bolehKelola } from "@/lib/sesi";
import { aturPersetujuan, hapusKomentarModerasi } from "@/lib/moderasi-komentar";

async function jaga() {
  const sesi = await bacaSesi();
  if (!sesi || !bolehKelola(sesi.peran)) redirect("/admin/masuk");
  return sesi;
}

/** Ubah status persetujuan komentar (server action). */
export async function aksiSetujui(id: number, disetujui: boolean) {
  await jaga();
  await aturPersetujuan(id, disetujui);
}

/** Hapus komentar beserta balasan dan reaksinya (server action). */
export async function aksiHapus(id: number) {
  const sesi = await jaga();
  if (sesi.peran !== "admin") redirect("/admin/komentar");
  await hapusKomentarModerasi(id);
}