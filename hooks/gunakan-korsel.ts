"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useKurangiGerak } from "./use-media-query";
import type { Berita } from "@/lib/events";

const DURASI = 550; // ms, selaras dengan durasi transisi pada jalur
const JEDA_OTOMATIS = 6000; // ms; 0 untuk mematikan putar otomatis

export type Kartu = { kunci: string; asli: number; isi: Berita };

/**
 * Keadaan korsel berita.
 *
 * Port dari komponen Alpine "korsel" di Pasopati. Yang dipertahankan persis:
 *
 * - Penggandaan tiga set, dan ambangnya TIGA berita. Jendela memperlihatkan
 *   tiga kartu sekaligus (kiri, aktif, kanan); dengan penggandaan kartu ke-i
 *   memuat berita (i mod n), jadi tetangga kiri dan kanan menunjuk berita yang
 *   sama ketika 2 habis dibagi n — terjadi untuk n = 1 dan n = 2. Di bawah tiga
 *   berita, kartu ditampilkan sekali saja dan gulirannya berhenti melingkar.
 * - Lebar kartu diukur dari DOM, bukan ditulis tetap: --kartu-lebar dan
 *   --kartu-sela berbeda antara mode aliran dan panggung.
 */
export function gunakanKorsel(berita: Berita[]) {
  const gulung = berita.length >= 3;
  const salinan = gulung ? 3 : 1;

  // Mulai di salinan TENGAH pada kartu ke-0 (berita[0]) supaya kartu pertama —
  // laporan terbaru — yang tersorot di tengah. (Mode non-loop juga memusatkan
  // berita[0]; sebelumnya loop keliru memakai +1 sehingga memusatkan berita[1].)
  const [aktif, setAktif] = useState(gulung ? berita.length : 0);
  // null = belum diukur: jalur menempatkan dirinya lewat calc() CSS (lihat
  // korsel.tsx) supaya bingkai PERTAMA hasil SSR sudah di tengah. Tanpa itu
  // isi yang di-stream masuk sempat tergambar dengan geser=0 — seluruh rak
  // terdorong ke kanan separuh lebarnya — lalu melompat ke tengah begitu
  // efek pasang berjalan: kedipan setelah kerangka diganti.
  const [geser, setGeser] = useState<number | null>(null);
  const [diam, setDiam] = useState(true); // true = transisi dimatikan
  const [terlihat, setTerlihat] = useState(true);

  const jalurRef = useRef<HTMLDivElement | null>(null);
  const kunci = useRef(false);
  const ukuran = useRef({ lebarKartu: 0, langkah: 0 });
  const pewaktu = useRef<ReturnType<typeof setInterval> | null>(null);
  const pengaman = useRef<ReturnType<typeof setTimeout> | null>(null);

  const kurangiGerak = useKurangiGerak();

  const kartu = useMemo<Kartu[]>(() => {
    const semua: Kartu[] = [];
    for (let s = 0; s < salinan; s++) {
      berita.forEach((isi, i) => semua.push({ kunci: `${s}-${i}`, asli: i, isi }));
    }
    return semua;
  }, [berita, salinan]);

  /** Harus <article>: anak pertama jalur adalah elemen ukur, lebarnya nol. */
  const ukur = useCallback(() => {
    const jalur = jalurRef.current;
    const pertama = jalur?.querySelector("article");
    if (!jalur || !pertama) return;
    const gaya = getComputedStyle(jalur);
    const sela = parseFloat(gaya.columnGap || gaya.gap) || 0;
    // offsetWidth: lebar tata letak, tidak terpengaruh scale kartu aktif
    // maupun scale kanvas panggung.
    ukuran.current = {
      lebarKartu: pertama.offsetWidth,
      langkah: pertama.offsetWidth + sela,
    };
  }, []);

  const terapkan = useCallback((indeks: number, beranimasi: boolean) => {
    setDiam(!beranimasi);
    const { lebarKartu, langkah } = ukuran.current;
    setGeser(-(indeks * langkah + lebarKartu / 2));
  }, []);

  const normalkan = useCallback(() => {
    if (pengaman.current) { clearTimeout(pengaman.current); pengaman.current = null; }
    if (!gulung) { kunci.current = false; return; }

    const a = aktifRef.current;
    const n = berita.length;
    // Kembalikan indeks ke set tengah tanpa animasi supaya geser tak habis.
    if (a < n || a >= n * 2) {
      const baru = (a % n) + n;
      terapkan(baru, false);
      setAktif(baru);
    }
    kunci.current = false;
  }, [berita.length, gulung, terapkan]);

  const aktifRef = useRef(aktif);
  useEffect(() => {
    aktifRef.current = aktif;
  }, [aktif]);

  // Bersihkan timer pengaman saat unmount
  useEffect(() => {
    return () => {
      if (pengaman.current) clearTimeout(pengaman.current);
    };
  }, []);

  const pindah = useCallback((arah: number) => {
    if (berita.length < 2 || kunci.current) return;
    kunci.current = true;

    setAktif((a) => {
      const n = berita.length;
      // Tanpa kembaran, indeks harus tetap di dalam satu-satunya set yang
      // dirender — dua berita jadi bertukar bolak-balik.
      const baru = gulung ? a + arah : ((a + arah) % n + n) % n;
      terapkan(baru, true);
      return baru;
    });

    if (kurangiGerak) { normalkan(); return; }
    // Jaring pengaman kalau transitionend tak pernah datang (tab di latar,
    // animasi terpotong).
    if (pengaman.current) clearTimeout(pengaman.current);
    pengaman.current = setTimeout(normalkan, DURASI + 150);
  }, [berita.length, gulung, kurangiGerak, normalkan, terapkan]);

  const hentikanOtomatis = useCallback(() => {
    if (pewaktu.current) clearInterval(pewaktu.current);
    pewaktu.current = null;
  }, []);

  const mulaiOtomatis = useCallback(() => {
    if (berita.length < 2 || !JEDA_OTOMATIS || kurangiGerak) return;
    hentikanOtomatis();
    pewaktu.current = setInterval(() => pindah(1), JEDA_OTOMATIS);
  }, [berita.length, kurangiGerak, hentikanOtomatis, pindah]);

  /** Klik kartu tetangga menjadikannya aktif. */
  const keKartu = useCallback((indeks: number) => {
    const selisih = indeks - aktif;
    if (selisih === 1 || selisih === -1) pindah(selisih);
  }, [aktif, pindah]);

  // Penempatan awal, lalu ukur ulang saat ukuran/mode berubah.
  useEffect(() => {
    if (!berita.length) return;
    ukur();
    terapkan(aktifRef.current, false);

    let tunda: ReturnType<typeof setTimeout> | null = null;
    const saatUbah = () => {
      if (tunda) clearTimeout(tunda);
      // Gunakan aktifRef terkini agar tidak melompat ke indeks lama saat resize
      tunda = setTimeout(() => { ukur(); terapkan(aktifRef.current, false); }, 60);
    };
    window.addEventListener("resize", saatUbah);
    return () => { window.removeEventListener("resize", saatUbah); if (tunda) clearTimeout(tunda); };
  }, [berita.length, ukur, terapkan]);

  // Korsel hanya berjalan selama sectionnya tampak.
  useEffect(() => {
    if (terlihat) mulaiOtomatis(); else hentikanOtomatis();
    return hentikanOtomatis;
  }, [terlihat, mulaiOtomatis, hentikanOtomatis]);

  return {
    kartu, aktif, geser, diam, gulung, jalurRef, kurangiGerak,
    pindah, keKartu, normalkan, mulaiOtomatis, hentikanOtomatis, setTerlihat,
  };
}

/** Sekali pasang; nilainya tidak berubah selama halaman hidup. */
export { useKurangiGerak } from "./use-media-query";
