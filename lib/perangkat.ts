/**
 * Mendeteksi jumlah kolom umpan awal berdasarkan header HTTP.
 *
 * Menerima objek yang memiliki metode `get(name: string): string | null` (seperti `Headers`),
 * sehingga dapat diuji secara murni di lingkungan Node tanpa runtime Next.js.
 */
export function deteksiKolomDariHeaders(reqHeaders: { get(name: string): string | null }): number {
  // 1. Client Hints (Chromium di Android, Chrome Mobile, Edge Mobile, Samsung Browser, dsb.)
  const chMobile = reqHeaders.get("sec-ch-ua-mobile");
  if (chMobile === "?1") return 2;
  if (chMobile === "?0") return 3;

  // 2. User-Agent string
  const ua = (reqHeaders.get("user-agent") ?? "").toLowerCase();
  if (!ua) return 3;

  // Pola untuk perangkat seluler dan tablet:
  // - iPhone, iPad, iPod
  // - Android (ponsel maupun tablet)
  // - Mobile browser (Opera Mini, IEMobile, dsb.)
  const polaSeluler = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|silk|kindle|webos/i;
  if (polaSeluler.test(ua)) {
    return 2;
  }

  return 3;
}

/**
 * Membaca header permintaan di Server Component dan mengembalikan jumlah kolom awal.
 *
 * Mengembalikan 2 untuk ponsel/tablet (menghilangkan kedipan 3 kolom -> 2 kolom di seluler),
 * dan 3 untuk peramban desktop.
 */
export async function ambilKolomUmpanAwal(): Promise<number> {
  try {
    const { headers } = await import("next/headers");
    const reqHeaders = await headers();
    return deteksiKolomDariHeaders(reqHeaders);
  } catch {
    return 3;
  }
}
