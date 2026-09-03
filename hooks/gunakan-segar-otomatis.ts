"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Penyegar otomatis halaman publik — supaya pengunjung tidak perlu hard reload.
 *
 * Halaman kita `force-dynamic`, jadi datanya segar setiap kali dimuat. Tapi
 * selama pengunjung berdiam di satu halaman (SPA, tanpa navigasi), props dari
 * Server Component tidak pernah diperbarui: kejadian baru yang masuk lewat CMS
 * tidak akan muncul sampai halaman dimuat ulang. Hook ini memanggil
 * `router.refresh()` — yang memuat ulang Server Component TANPA me-reload
 * dokumen — tepat saat tab kembali terlihat (balik dari tab/aplikasi lain).
 *
 * Ditambah pemulihan otomatis jika terdeteksi `ChunkLoadError` (akibat deploy baru
 * yang membuang chunk lama saat tab masih terbuka): browser langsung me-reload
 * halaman penuh untuk mengambil aset dan build terbaru tanpa perlu intervensi manual.
 */
export function gunakanSegarOtomatis() {
  const router = useRouter();

  useEffect(() => {
    // Tangani bila ada chunk JS yang gagal dimuat (mis. chunk lama 404 setelah deploy baru).
    // Browser otomatis reload untuk mengambil bundel versi terbaru.
    const tanganiChunkBasi = (e: ErrorEvent) => {
      const pesan = e.message || "";
      if (
        pesan.includes("ChunkLoadError") ||
        pesan.includes("Failed to fetch dynamically imported module") ||
        pesan.includes("Loading chunk")
      ) {
        window.location.reload();
      }
    };
    window.addEventListener("error", tanganiChunkBasi);

    const saatTerlihat = () => {
      if (document.hidden) return;
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      router.refresh();
    };

    document.addEventListener("visibilitychange", saatTerlihat);
    return () => {
      window.removeEventListener("error", tanganiChunkBasi);
      document.removeEventListener("visibilitychange", saatTerlihat);
    };
  }, [router]);
}
