"use server";

import { redirect } from "next/navigation";
import { hapusSesi } from "@/lib/sesi";

/** Keluar dari CMS. Cookie sesi dibuang di server, bukan sekadar dilupakan di
 *  klien: cookienya httpOnly, jadi hanya server yang bisa mencabutnya. */
export async function keluar() {
  await hapusSesi();
  redirect("/admin/login");
}
