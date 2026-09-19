"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { bacaSesi, bolehKelola } from "@/lib/sesi";
import { simpanSorotan } from "@/lib/statistik-sorotan";

/** Server action terbuka lewat POST langsung — sesinya diperiksa di dalam. */
export async function aksiSimpanSorotan(data: FormData) {
  const sesi = await bacaSesi();
  if (!sesi || !bolehKelola(sesi.peran)) redirect("/admin/login");
  const hasil = await simpanSorotan(data);
  if (hasil.ok) {
    revalidatePath("/[locale]/karhutla", "page");
    revalidatePath("/[locale]/karhutla/panel", "page");
  }
  return hasil;
}
