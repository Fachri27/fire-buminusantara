"use server";

import { redirect } from "next/navigation";
import { updateTag } from "next/cache";
import { bacaSesi, bolehKelola } from "@/lib/sesi";
import { prisma } from "@/lib/prisma";

/** Alih keadaan tayang satu kejadian, langsung dari daftar (tanpa buka form).
 *  Dua arah, bisa bolak-balik: menurunkan yang tayang tidak menghapus apa pun. */
export async function aksiTayang(id: number, status: "draft" | "published") {
  const sesi = await bacaSesi();
  if (!sesi || !bolehKelola(sesi.peran)) redirect("/admin/login");

  await prisma.events.update({ where: { id }, data: { status, updated_at: new Date() } });
  // Pratinjau bagikan + daftar publik di-cache: tanpa ini kejadian yang
  // diturunkan masih tampil sampai cache kedaluwarsa sendiri.
  try {
    updateTag("kejadian");
  } catch {}
  return { ok: true as const };
}
