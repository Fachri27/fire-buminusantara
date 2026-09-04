/**
 * Penanda proses berjalan di dalam tombol CMS.
 *
 * Tombol aksi di CMS memanggil server action lalu menyegarkan halaman —
 * jeda yang bisa satu dua detik, dan selama itu satu-satunya tanda dulu hanya
 * tombol yang meredup karena disabled. Petugas menekan sekali, tidak yakin
 * apakah kena, lalu menekan lagi.
 *
 * SENGAJA tidak mengganti label tombolnya. Label yang berubah ("Verifikasi" →
 * "Memverifikasi…") mengubah lebar tombol, dan sebaris tombol yang saling
 * bergeser saat salah satunya ditekan justru terbaca seperti kekacauan.
 * Cincinnya menempel di depan label, memakai `gap` yang sudah ada di
 * .cms-tombol.
 *
 * `currentColor` supaya ia benar di tombol hijau (teks putih) maupun tombol
 * garis (teks gelap) tanpa varian tersendiri. Bagi yang mematikan animasi,
 * cincinnya tetap tampil — hanya berhenti berputar; teks sr-only di
 * pemanggilnya yang menyampaikan keadaannya.
 */
export function Pemuat() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="size-[13px] shrink-0 animate-spin motion-reduce:animate-none"
    >
      {/* Lingkaran penuh yang samar + busur pekat: yang berputar terbaca dari
          bedanya, bukan dari satu garis yang seolah berkedip. */}
      <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.28" />
      <path
        d="M8 1.5a6.5 6.5 0 0 1 6.5 6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
