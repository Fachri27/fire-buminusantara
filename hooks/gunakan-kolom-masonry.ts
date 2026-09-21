"use client";

import { useSyncExternalStore } from "react";

/* Geometri rel kanan saat peta dilipat, disalin dari halaman-peta.tsx:
   rel kiri = clamp(248px, 16.67vw, 320px), lalu lajurnya memuat sela 8px,
   grid punya padding 8px di kedua sisi, dan rel sendiri berpadding 20px kiri
   kanan. Totalnya 64px di luar rel kiri. */
const REL_KIRI_MIN = 248;
const REL_KIRI_MAKS = 320;
const REL_KIRI_RASIO = 0.1667;
/* Rel kiri terbuka: 8px padding grid x2 + 8px sela lajur + 20px padding rel
   kiri + 20px kanan. Tombolnya mengapung di celah antar-rel, bukan di dalam
   rel, jadi tak ada selokan yang memakan lebar. */
const SELA_DAN_PADDING = 64;

/* Rel kiri tertutup: tak ada rel kiri maupun selanya, tapi padding kiri rel
   naik jadi 64px (pl-16) untuk menampung tombol yang kini masuk ke dalam.
   16px padding grid + 64px selokan + 20px padding kanan. */
const SELA_DAN_PADDING_TANPA_REL = 100;

/**
 * Lebar wadah masonry untuk lebar layar tertentu.
 *
 * Bergantung pada keadaan rel kiri, bukan hanya lebar layar:
 *
 * - Rel kiri TERBUKA: tombol buka-peta mengapung di celah antara kedua rel,
 *   jadi rel kanan tidak perlu selokan dan padding kirinya normal (20px).
 *   Sisanya = layar - rel kiri - 8px sela lajur - 16px padding grid - 40px
 *   padding rel = layar - rel kiri - 64.
 * - Rel kiri TERTUTUP: celah itu jadi tepi layar, jadi tombolnya masuk ke
 *   dalam rel dan padding kiri naik ke 64px (pl-16). Rel kiri sendiri 0.
 *   Sisanya = layar - 16px padding grid - 64px selokan - 20px padding kanan.
 */
function lebarWadah(lebarLayar: number, relKiriTerbuka: boolean): number {
  if (!relKiriTerbuka) return lebarLayar - SELA_DAN_PADDING_TANPA_REL;
  const relKiri = Math.min(REL_KIRI_MAKS, Math.max(REL_KIRI_MIN, lebarLayar * REL_KIRI_RASIO));
  return lebarLayar - relKiri - SELA_DAN_PADDING;
}

/**
 * Jumlah kolom masonry rel kanan.
 *
 * Ambangnya memakai lebar WADAH, bukan lebar layar. Versi sebelumnya memakai
 * lebar layar (meniru breakpoint sm/2xl milik CSS columns) dan itu salah
 * sasaran: yang menentukan muat berapa kolom adalah rel tempat kartunya
 * berdiri, bukan monitornya. Akibatnya layar 125% yang lebar viewport-nya
 * jatuh sedikit di bawah 1536 langsung turun ke 2 kolom padahal relnya masih
 * selebar 1216px — cukup untuk 4.
 *
 * Lebar wadah dihitung, bukan diukur. Mengukur lewat ResizeObserver berarti
 * render pertama mendapat lebar 0 lalu melompat — kedipan tata letak yang
 * justru sedang dihindari — dan menyetel state dari dalam effect dilarang
 * `react-hooks/set-state-in-effect`. Rumusnya cocok persis dengan pengukuran
 * nyata: 1920 -> 1536, 1536 -> 1216, 1366 -> 1054, 1280 -> 968.
 *
 * Ambang 4 kolom sengaja rendah (wadah >= 900px): jumlah kolom yang SAMA di
 * 100% dan 125% lebih penting daripada lebar kartu yang nyaman, karena layar
 * 125% yang sama persis besarnya tak boleh tampil berbeda dari yang 100%.
 *
 * Dengan rel kiri terbuka, harganya kartu menyempit — 366px di 1920, 286px di
 * 1536, 245px di 1366, 224px di 1280 — sehingga judul turun ke dua baris dan
 * baris lokasi terpotong elipsis. Dengan rel kiri tertutup wadahnya jauh lebih
 * lega (1820px di 1920), jadi kartunya justru melebar.
 *
 * Ambangnya 900, bukan 960, supaya layar 1280 tetap 4 kolom di kedua keadaan
 * rel kiri, bukan diam-diam jatuh ke 3 di salah satunya.
 *
 * useSyncExternalStore, bukan useState + useEffect, dengan alasan yang sama.
 * Snapshot server sengaja lebar: masonry baru muncul setelah peta dilipat —
 * aksi klien — jadi nilai server tak pernah ikut terhidrasi ke markup.
 */
export function gunakanKolomMasonry(relKiriTerbuka: boolean): number {
  const lebar = useSyncExternalStore(
    (ubah) => {
      window.addEventListener("resize", ubah);
      return () => window.removeEventListener("resize", ubah);
    },
    () => window.innerWidth,
    () => 1920,
  );

  const wadah = lebarWadah(lebar, relKiriTerbuka);
  if (wadah >= 900) return 4;
  // 640, bukan 820: tanpa ini layar 1100px (wadah 788) melompat dari 4 kolom
  // langsung ke 2.
  if (wadah >= 640) return 3;
  if (wadah >= 420) return 2;
  return 1;
}
