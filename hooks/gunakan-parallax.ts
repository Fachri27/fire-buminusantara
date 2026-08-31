"use client";

import { useEffect } from "react";

const SCRUB_TEPI = true;

/**
 * Tepi lunak + guliran halus.
 *
 * Ketiganya satu hook karena memang satu kesatuan: Lenis yang melunakkan
 * guliran, ScrollTrigger yang menggerakkan animasinya, dan Lenis dijalankan
 * DARI ticker GSAP supaya seluruh halaman berdenyut pada satu jam yang sama —
 * dua rAF yang berebut membuat animasi tampak sedikit meleset dari gulirannya.
 *
 * @param kunciGulir true saat pop-up terbuka; Lenis dihentikan supaya roda di
 *   dalam panel tidak ikut menggerakkan halaman di belakangnya.
 */
export function gunakanParallax(kunciGulir: boolean) {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let bersihkan: (() => void) | undefined;

    (async () => {
      const { gsap } = await import("gsap");
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      const Lenis = (await import("lenis")).default;

      gsap.registerPlugin(ScrollTrigger);

      // Lenis dibuat SEBELUM pemicu ScrollTrigger: ia mengubah tinggi html, dan
      // ScrollTrigger mengukur posisi pemicu saat dibuat.
      const lenis = new Lenis({
        // Rujukan memakai 1.15. Di sini lebih pendek: halaman ini hanya sekitar
        // dua layar dan layar pertamanya di-pin, jadi luncuran sepanjang itu
        // terasa menggantung — jarak gulirnya keburu habis sebelum luncurannya
        // selesai. Angka hasil mencoba langsung, jangan dinaikkan tanpa diuji.
        duration: 0.7,
        smoothWheel: true,
      });
      (window as unknown as { lenis?: unknown }).lenis = lenis;

      lenis.on("scroll", ScrollTrigger.update);
      const detak = (waktu: number) => lenis.raf(waktu * 1000); // ticker detik, Lenis milidetik
      gsap.ticker.add(detak);
      // Matikan koreksi lag GSAP yang, saat satu frame telat, melompatkan
      // animasi untuk "mengejar".
      gsap.ticker.lagSmoothing(0);

      const konteks = gsap.context(() => {
        // Foto latar hero dan section 2 sengaja DIAM — parallax-nya dilepas.
        // Yang tersisa hanya tepi lunak: --kabur-tepi 1 saat tepi atas section
        // menyentuh tepi bawah viewport, 0 saat tiba di atas.
        gsap.utils.toArray<HTMLElement>("[data-kabur-tepi]").forEach((bagian) => {
          const setel = gsap.quickSetter(bagian, "--kabur-tepi");
          const nilai = { v: 1 };
          gsap.to(nilai, {
            v: 0, ease: "none",
            scrollTrigger: {
              trigger: bagian, start: "top bottom", end: "top top",
              // Nilainya menyatakan jarak section ke tepi atas viewport, jadi
              // harus cocok dengan posisi sebenarnya — kalau ditunda, pudarnya
              // tidak lagi sejalan dengan yang terlihat.
              scrub: SCRUB_TEPI, invalidateOnRefresh: true,
            },
            onUpdate: () => setel(nilai.v.toFixed(3)),
          });
        });
      });

      // Hitung ulang setelah gambar selesai dimuat: posisi pemicu yang dihitung
      // sebelum gambar punya tinggi akan meleset.
      const saatMuat = () => ScrollTrigger.refresh();
      window.addEventListener("load", saatMuat);

      bersihkan = () => {
        window.removeEventListener("load", saatMuat);
        gsap.ticker.remove(detak);
        konteks.revert();
        lenis.destroy();
      };
    })();

    return () => bersihkan?.();
  }, []);

  // Pop-up menutupi layar: guliran halaman di belakangnya dihentikan.
  useEffect(() => {
    const lenis = (window as unknown as { lenis?: { stop(): void; start(): void } }).lenis;
    if (!lenis) return;
    if (kunciGulir) lenis.stop(); else lenis.start();
  }, [kunciGulir]);
}
