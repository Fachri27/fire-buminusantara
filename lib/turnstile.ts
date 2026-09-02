/**
 * Cloudflare Turnstile.
 *
 * Dipisah dari lib/komentar.ts sejak form laporan warga ikut memakainya:
 * dua pemanggil, satu aturan.
 *
 * Perilaku saat TURNSTILE_SECRET_KEY tidak terpasang BEDA menurut lingkungan:
 *
 *   - pengembangan (NODE_ENV !== "production") → verifikasi DILEWATI, supaya
 *     kerja lokal tidak terhalang men-setup Cloudflare.
 *   - produksi → verifikasi GAGAL (fail-closed). Lupa memasang secret dulu
 *     berarti "return true" diam-diam — form publik terbuka lebar untuk bot,
 *     tanpa gejala apa pun. Menutup di produksi memaksa kesalahan itu terlihat
 *     (semua kiriman ditolak) alih-alih membiarkannya jadi lubang senyap.
 */
export async function turnstileSah(token: string | null, ip: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    // Fail-open HANYA di pengembangan; di produksi tidak ada secret = tidak lolos.
    console.log("[turnstile] TIDAK ADA secret; NODE_ENV=", process.env.NODE_ENV);
    return process.env.NODE_ENV !== "production";
  }
  // Token Turnstile paling panjang 2048 karakter — yang lebih panjang dari itu
  // pasti bukan token sah, tidak ada gunanya mengirimkannya ke Cloudflare.
  if (!token || token.length > 2048) {
    console.log("[turnstile] token kosong/tidak valid; panjang=", token ? token.length : 0);
    return false;
  }

  try {
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token, ...(ip ? { remoteip: ip } : {}) }),
      // Kiriman warga tidak boleh menggantung selamanya hanya karena siteverify
      // lambat; batas 10 detik, dan lewatnya batas itu jatuh ke fail-closed di bawah.
      signal: AbortSignal.timeout(10_000),
    });
    const data = await r.json();
    console.log("[turnstile] siteverify →", data?.success, "err=", JSON.stringify(data?.["error-codes"]));
    return Boolean(data?.success);
  } catch (e) {
    console.log("[turnstile] siteverify EXCEPTION:", (e as Error)?.message);
    return false;
  }
}

/**
 * Alamat pengirim, sejauh yang benar-benar bisa dipercaya.
 *
 * `X-Forwarded-For` bisa dipalsukan siapa saja: nilai paling kiri berasal dari
 * klien, bukan dari proxy. Karena itu header ini HANYA dibaca sebanyak proxy
 * tepercaya yang memang ada di depan aplikasi — disetel lewat
 * `TRUSTED_PROXY_HOPS`:
 *
 *   - 0 (bawaan) → X-Forwarded-For diabaikan sama sekali. Tanpa proxy di depan,
 *     tidak ada nilai yang layak dipercaya, jadi lebih baik null daripada IP
 *     karangan.
 *   - N → ambil elemen ke-N dari KANAN. Tiap proxy tepercaya menambahkan satu
 *     hop di sisi kanan; klien hanya bisa menyuntik di sisi kiri, jadi menghitung
 *     dari kanan melewati suntikan itu. Deploy di belakang satu reverse proxy
 *     (nginx, Vercel, dsb.) memakai TRUSTED_PROXY_HOPS=1.
 *
 * IP ini dipakai Turnstile (remoteip) dan dicatat di baris laporan/komentar
 * untuk penelusuran — keduanya tidak ada gunanya kalau nilainya bisa dikarang.
 */
export function ipDari(req: Request): string | null {
  const hops = Number(process.env.TRUSTED_PROXY_HOPS ?? "0");
  if (!Number.isInteger(hops) || hops < 1) return null;

  const rantai = (req.headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (rantai.length === 0) return null;

  // Elemen ke-`hops` dari kanan = IP yang ditulis proxy terluar yang tepercaya.
  // Kalau rantainya lebih pendek dari jumlah hop yang diklaim, ambil yang paling
  // kiri yang tersedia — konfigurasi keliru tidak boleh malah membocorkan IP
  // suntikan sebagai kalau-kalau sah.
  const idx = rantai.length - hops;
  return rantai[Math.max(0, idx)] ?? null;
}
