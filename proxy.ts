import { NextResponse, type NextRequest } from "next/server";
import { BAHASA } from "@/lib/bahasa";

/**
 * Pengalih prefiks bahasa. URL tanpa prefiks (mis. /) dikirim ke /id/…
 * — /id adalah bahasa bawaan; proxy ini tidak bernegosiasi dengan
 * Accept-Language, satu bahasa bawaan cukup untuk dua bahasa saja.
 *
 * CMS (admin), API, dan rute media TIDAK berprefiks bahasa dan harus
 * lewat apa adanya — karena itu matcher mengecualikannya.
 *
 * Mode etalase (PETA_SAJA=1, mis. deploy Vercel coba-coba): semua halaman
 * publik selain /<locale>/peta dialihkan ke /id/peta, dan /admin
 * dikembalikan 404 — CMS tidak ikut dipamerkan.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (process.env.PETA_SAJA === "1") {
    if (pathname === "/admin" || pathname.startsWith("/admin/")) {
      return new NextResponse(null, { status: 404 });
    }
    const kePeta = BAHASA.some((b) => pathname === `/${b}/peta` || pathname.startsWith(`/${b}/peta/`));
    const aset = pathname.startsWith("/_next/") || pathname.startsWith("/assets/") || pathname.startsWith("/css/") ||
      pathname.startsWith("/api/") || pathname.startsWith("/media/") || pathname.includes(".");
    if (!kePeta && !aset) {
      request.nextUrl.pathname = "/id/peta";
      return NextResponse.redirect(request.nextUrl, 308);
    }
  }

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