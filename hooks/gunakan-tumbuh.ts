"use client";

import { useEffect, type RefObject } from "react";

export type TitikAsal = { x: number; y: number } | null;

/**
 * Pop-up yang tumbuh dari titik yang ditekan.
 *
 * CSS (.peta-popup) menahan animasinya dengan `animation-play-state: paused`
 * dan `both` — artinya panel dipaku pada keyframe awal, scale 0,14 dan opacity
 * 0. Tanpa hook ini panel dirender tetapi TIDAK TERLIHAT sama sekali.
 *
 * Jedanya baru dilepas dua frame kemudian, bukan seketika. Panel ini lahir di
 * frame yang sibuk: daftar beritanya dibangun, flatpickr dipasang, dan guliran
 * halaman dikunci. Animasi yang mulai di situ kehilangan frame-frame
 * pertamanya — dan awal animasi justru bagian yang paling terlihat. Frame
 * pertama untuk menuntaskan tata letak, frame kedua memberi compositor waktu
 * menyiapkan lapisan yang diminta will-change.
 */
export function gunakanTumbuh(
  ref: RefObject<HTMLElement | null>,
  asal: TitikAsal,
  /** Dipanggil setelah animasinya selesai. Dipakai menunda pekerjaan berat
   *  (mis. memasang pemilih tanggal) keluar dari jendela animasi. */
  onSelesai?: () => void,
) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (asal) {
      const kotak = el.getBoundingClientRect();
      if (kotak.width && kotak.height) {
        // Dijepit ke dalam panel: wilayah yang ditekan bisa berada di luarnya,
        // dan transform-origin di luar kotak membuat panel melesat masuk dari
        // samping alih-alih tumbuh.
        const x = Math.max(0, Math.min(kotak.width, asal.x - kotak.left));
        const y = Math.max(0, Math.min(kotak.height, asal.y - kotak.top));
        el.style.transformOrigin = `${x}px ${y}px`;
      }
    }

    let f2 = 0;
    const f1 = requestAnimationFrame(() => {
      f2 = requestAnimationFrame(() => el.classList.add("peta-popup--jalan"));
    });

    // Selesai: animasi dan lapisannya dilepas. Target dijaga — animationend
    // menggelembung, dan isi panel punya animasinya sendiri.
    const saatSelesai = (e: AnimationEvent) => {
      if (e.target !== el) return;
      el.classList.add("peta-popup--diam");
      onSelesai?.();
    };
    el.addEventListener("animationend", saatSelesai);

    return () => {
      cancelAnimationFrame(f1);
      if (f2) cancelAnimationFrame(f2);
      el.removeEventListener("animationend", saatSelesai);
    };
    // onSelesai sengaja tidak masuk daftar: pemanggilnya menyediakan fungsi
    // baru tiap render, dan memasukkannya akan mengulang animasi terus-menerus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, asal]);
}
