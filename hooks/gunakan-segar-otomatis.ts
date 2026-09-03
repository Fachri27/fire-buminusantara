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
 */
export function gunakanSegarOtomatis() {
  const router = useRouter();

  useEffect(() => {
    const saatTerlihat = () => {
      if (document.hidden) return;
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      router.refresh();
    };

    document.addEventListener("visibilitychange", saatTerlihat);
    return () => document.removeEventListener("visibilitychange", saatTerlihat);
  }, [router]);
}
