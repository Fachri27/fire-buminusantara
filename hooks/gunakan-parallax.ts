"use client";

import { useEffect } from "react";

/**
 * Pengontrol guliran halus (Lenis tanpa GSAP) + perhitungan tepi lunak.
 *
 * Menggunakan Lenis dengan autoRaf native (tanpa ticker GSAP / lagSmoothing)
 * dan wheelMultiplier 0.65 sehingga guliran terasa berbobot, tenang, dan
 * tidak terlalu cepat.
 *
 * @param kunciGulir true saat pop-up terbuka; guliran dihentikan.
 */
export function gunakanParallax(kunciGulir: boolean) {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const bagian = document.querySelectorAll<HTMLElement>("[data-kabur-tepi]");
      bagian.forEach((el) => el.style.setProperty("--kabur-tepi", "0"));
      return;
    }

    let bersihkan: (() => void) | undefined;

    (async () => {
      const Lenis = (await import("lenis")).default;

      const lenis = new Lenis({
        duration: 1.2,
        wheelMultiplier: 0.65,
        touchMultiplier: 0.8,
        smoothWheel: true,
        autoRaf: true,
      });

      (window as unknown as { lenis?: unknown }).lenis = lenis;

      const elemenDaftar = Array.from(
        document.querySelectorAll<HTMLElement>("[data-kabur-tepi]")
      );

      const perbarui = () => {
        const vh = window.innerHeight;
        if (vh <= 0 || !elemenDaftar.length) return;
        for (const el of elemenDaftar) {
          const rect = el.getBoundingClientRect();
          const sisa = Math.max(0, Math.min(1, rect.top / vh));
          el.style.setProperty("--kabur-tepi", sisa.toFixed(3));
        }
      };

      perbarui();
      lenis.on("scroll", perbarui);
      window.addEventListener("resize", perbarui, { passive: true });

      bersihkan = () => {
        lenis.off("scroll", perbarui);
        window.removeEventListener("resize", perbarui);
        lenis.destroy();
        (window as unknown as { lenis?: unknown }).lenis = undefined;
      };
    })();

    return () => bersihkan?.();
  }, []);

  // Pop-up aktif: hentikan guliran Lenis
  useEffect(() => {
    const lenis = (window as unknown as { lenis?: { stop(): void; start(): void } }).lenis;
    if (!lenis) {
      if (kunciGulir) {
        const awal = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
          document.body.style.overflow = awal;
        };
      }
      return;
    }
    if (kunciGulir) lenis.stop();
    else lenis.start();
  }, [kunciGulir]);
}
