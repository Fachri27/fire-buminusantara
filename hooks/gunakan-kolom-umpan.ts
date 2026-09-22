"use client";

import { useSyncExternalStore } from "react";

/* Jumlah kolom umpan landing karhutla — pola yang sama dengan
   gunakanKolomMasonry milik index: kolomnya dihitung di JS dari lebar wadah,
   bukan breakpoint CSS. Bedanya hanya geometrinya: rel kiri halaman ini =
   clamp(340px, 33.5vw, 680px), grid berpadding 8px di kedua sisi + sela 8px,
   dan rel kanan berpadding 16-20px di kedua sisi.

   `relKiriTerbuka` menentukan lebar wadahnya: saat rel dilipat, lajur umpan
   memenuhi layar dan ruang yang bertambah itu dipakai untuk kolom keempat.
   Bawaannya true supaya pemanggil yang tak peduli keadaan rel tetap mendapat
   perilaku lama.

   `kolomAwal` (opsional) disuplai dari pembacaan header di Server Component
   agar snapshot server cocok dengan perangkat pengunjung (2 kolom untuk seluler,
   3 untuk desktop), mencegah kedipan layout (awalnya 3 kolom lalu melompat ke 2
   saat hidrasi di peramban ponsel). */
export function gunakanKolomUmpan(relKiriTerbuka = true, kolomAwal?: number): number {
  const lebar = useSyncExternalStore(
    (ubah) => {
      window.addEventListener("resize", ubah);
      return () => window.removeEventListener("resize", ubah);
    },
    () => window.innerWidth,
    () => (kolomAwal !== undefined ? (kolomAwal <= 2 ? 390 : 1920) : 1920),
  );
  // Aliran (satu kolom menumpuk): wadah = layar - pias grid - padding rel.
  // Seluler pun 2 kolom seperti rujukan (grid foto ganda ala X) — 1 kolom
  // hanya untuk layar sangat sempit.
  if (lebar < 1100) return lebar >= 360 ? 2 : 1;
  const relKiri = Math.min(680, Math.max(340, lebar * 0.335));
  const wadah = relKiriTerbuka ? lebar - relKiri - 56 : lebar - 56;
  /* Tingkat keempat digerbangi keadaan rel, bukan lebar semata. Dengan ambang
     lebar murni, layar 1920 ber-rel TERBUKA (wadah 1221) ikut jadi 4 kolom —
     padahal rujukan desainnya mentok 3 di keadaan itu. Ambang 1100 membuat
     1280 tertutup (wadah 1224) dapat 4, sementara 1100 tertutup (1044) tetap
     3 supaya kartunya tak menyempit di bawah ~250px. */
  if (!relKiriTerbuka && wadah >= 1100) return 4;
  if (wadah >= 600) return 3;
  if (wadah >= 420) return 2;
  return 1;
}
