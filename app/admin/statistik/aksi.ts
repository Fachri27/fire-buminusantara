"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { bacaSesi, bolehKelola } from "@/lib/sesi";
import { simpanSorotan } from "@/lib/statistik-sorotan";

/** Server action terbuka lewat POST langsung — sesinya diperiksa di dalam. */
export async function aksiSimpanSorotan(data: FormData) {
  const sesi = await bacaSesi();
  if (!sesi || !bolehKelola(sesi.peran)) redirect("/admin/login");
  const hasil = await simpanSorotan(data);
  if (hasil.ok) {
    // ambilSorotan di-cache dengan tag ini.
    updateTag("sorotan");
    // Kartu angka tampil di landing /[locale] (bukan cuma halaman karhutla)
    // — pola revalidate ganda mengikuti simpan-kejadian.ts.
    revalidatePath("/[locale]", "page");
    revalidatePath("/id", "page");
    revalidatePath("/en", "page");
    revalidatePath("/[locale]/karhutla", "page");
    revalidatePath("/id/karhutla", "page");
    revalidatePath("/en/karhutla", "page");
    revalidatePath("/[locale]/karhutla/panel", "page");
    revalidatePath("/id/karhutla/panel", "page");
    revalidatePath("/en/karhutla/panel", "page");
  }
  return hasil;
}
