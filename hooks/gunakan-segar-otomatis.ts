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
 * Sengaja TANPA interval/timer: refresh terjadi pada satu-satunya momen di
 * mana kesegaran benar-benar penting (user kembali menatap halaman), sehingga
 * tab yang dibiarkan terbuka tapi tak dilihat tidak membebani server sama
 * sekali. State klien (pop-up rincian yang terbuka, ketikan komentar, posisi
 * korsel) tidak hilang: refresh hanya mengganti props dari server.
 *
 * View baru hasil deploy ditangani DUA lapis bawaan framework (bukan polling
 * versi sendiri): `deploymentId` di next.config.ts membuat Next otomatis
 * reload penuh saat RSC mendeteksi deployment baru — dan `router.refresh()`
 * di bawah inilah yang memicu permintaan RSC itu. Jaring pengaman kedua:
 * bila chunk JS lama gagal dimuat (404 setelah deploy), reload penuh juga.
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
