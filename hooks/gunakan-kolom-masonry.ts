"use client";

import { useSyncExternalStore } from "react";

/**
 * Jumlah kolom masonry rel kanan, dari lebar layar.
 *
 * Ada di sini, bukan di dalam komponennya, karena `rules-of-hooks` hanya
 * mengenali awalan "use": hook berawalan "gunakan" salah dibaca sebagai
 * "bukan hook", dan eslint.config.mjs mematikan aturan itu khusus untuk
 * hooks/**. Menaruhnya di komponen berarti menambal aturan satu per satu.
 *
 * useSyncExternalStore, bukan useState + useEffect: menyetel state di dalam
 * effect berarti render kedua sebelum cat pertama, dan repo ini memang
 * menyalakan `react-hooks/set-state-in-effect` sebagai error.
 *
 * Snapshot server sengaja lebar. Masonry baru muncul setelah peta dilipat —
 * aksi klien — jadi nilai server tak pernah ikut terhidrasi ke markup dan
 * tidak bisa memicu ketidakcocokan hidrasi.
 *
 * Ambangnya menyamai breakpoint yang dulu dipakai CSS columns: sm (640px)
 * dan 2xl (1536px).
 */
export function gunakanKolomMasonry(): number {
  const lebar = useSyncExternalStore(
    (ubah) => {
      window.addEventListener("resize", ubah);
      return () => window.removeEventListener("resize", ubah);
    },
    () => window.innerWidth,
    () => 1920,
  );

  return lebar >= 1536 ? 3 : lebar >= 640 ? 2 : 1;
}
