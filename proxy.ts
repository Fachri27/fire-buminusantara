import { NextResponse, type NextRequest } from "next/server";
import { BAHASA } from "@/lib/bahasa";

/**
 * Pengalih prefiks bahasa. URL tanpa prefiks (mis. /) dikirim ke /id/…
 * — /id adalah bahasa bawaan; proxy ini tidak bernegosiasi dengan
 * Accept-Language, satu bahasa bawaan cukup untuk dua bahasa saja.
 *
 * CMS (admin), API, dan rute media TIDAK berprefiks bahasa dan harus
 * lewat apa adanya — karena itu matcher mengecualikannya.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const adaPrefiks = BAHASA.some((b) => pathname === `/${b}` || pathname.startsWith(`/${b}/`));
  if (adaPrefiks) return;

  request.nextUrl.pathname = `/${BAHASA[0]}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(request.nextUrl);
}

export const config = {
  // Lewati internal Next.js, rute tanpa-bahasa (admin/api/media), berkas
  // statis, dan semua yang berekstensi (favicon.ico dsb.).
  matcher: ["/((?!_next|admin|api|media|assets|.*\\..*).*)"],
};