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
import { catatGalat } from "./catat-galat.ts";
import { URL_SITUS } from "./situs.ts";

// Kunci in-flight untuk mencegah dua permintaan paralel menggunakan token yang sama secara bersamaan
const tokenInFlight = new Set<string>();

/**
 * Hostname tempat widget boleh diselesaikan: asal NEXT_PUBLIC_SITE_URL plus
 * WEBAUTHN_ORIGIN (daftar koma, semua domain yang melayani situs — termasuk
 * domain API aplikasi, yang menyajikan halaman /api/mobile/captcha).
 */
function hostSah(): Set<string> {
  const hasil = new Set<string>();
  for (const asal of [URL_SITUS, ...(process.env.WEBAUTHN_ORIGIN ?? "").split(",")]) {
    try {
      hasil.add(new URL(asal.trim()).hostname);
    } catch {}
  }
  // localhost hanya untuk pengembangan, walau tertulis di daftar asal produksi.
  hasil.delete("localhost");
  return hasil;
}

/**
 * `aksi` (opsional) harus sama dengan opsi `action` widget yang menerbitkan
 * token — mis. token widget laporan (tanpa action) tidak berlaku untuk komentar.
 */
export async function turnstileSah(token: string | null, ip: string | null, aksi?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    // Fail-open HANYA di pengembangan; di produksi tidak ada secret = tidak lolos.
    return process.env.NODE_ENV !== "production";
  }
  // Token Turnstile paling panjang 2048 karakter — yang lebih panjang dari itu
  // pasti bukan token sah, tidak ada gunanya mengirimkannya ke Cloudflare.
  if (!token || token.length > 2048) {
    return false;
  }

  // Tolak jika token ini sedang diverifikasi secara simultan di request paralel lain
  if (tokenInFlight.has(token)) {
    console.warn("[turnstile] Permintaan paralel ganda dengan token identik dicegat:", token.slice(0, 16));
    return false;
  }

  tokenInFlight.add(token);

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
    if (!data?.success) return false;
    // Di luar produksi kunci uji Cloudflare menjawab hostname/action tiruan, dan
    // halaman dibuka dari localhost/IP LAN — pencocokan hanya di produksi.
    if (process.env.NODE_ENV !== "production") return true;
    if (hostSah().has(data.hostname) && (!aksi || data.action === aksi)) return true;
    // Token sah dari halaman lain (domain belum didaftarkan = salah konfigurasi, atau peniru).
    void catatGalat("turnstile-tak-cocok", new Error(`hostname "${data.hostname}" action "${data.action}"`), `harap aksi "${aksi ?? "-"}"`);
    return false;
  } catch {
    return false;
  } finally {
    tokenInFlight.delete(token);
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
  // Kalau rantainya lebih pendek dari jumlah hop yang diklaim, tolak dan kembalikan null
  // untuk mencegah IP spoofing dari header suntikan.
  if (rantai.length < hops) return null;

  return rantai[rantai.length - hops] ?? null;
}
