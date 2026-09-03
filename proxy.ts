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
  if (!adaPrefiks) {
    request.nextUrl.pathname = `/${BAHASA[0]}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(request.nextUrl, 308);
  }

  const match = pathname.match(/^\/(id|en)(\/|$)/);
  const locale = match ? match[1] : BAHASA[0];
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-locale", locale);
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  // Lewati internal Next.js, rute tanpa-bahasa (admin/api/media), berkas
  // statis, dan semua yang berekstensi (favicon.ico, robots.txt, llms.txt dsb.).
  matcher: ["/((?!_next|admin|api|media|assets|llms|robots|sitemap|.*\\..*).*)"],
};