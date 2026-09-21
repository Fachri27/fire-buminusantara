"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Bahasa } from "@/lib/bahasa";
import type { Berita } from "@/lib/events";
import { RincianLaporan } from "@/components/rincian-laporan";
import {
  TampilanPostingan, LembarKomentar,
  IkonBeranda, IkonUmpan, IkonTulis,
  type Laporan,
} from "@/components/landing-karhutla";

/** Isi halaman detail gambar seluler: Nav + Postingan mengalir + bilah tab,
 *  dengan tumpukan overlay yang sama seperti di umpan (lembar opsi, lembar
 *  komentar, pop-up rincian). */
export function HalamanPostingan({ berita: b, bahasa }: { berita: Berita; bahasa: Bahasa }) {
  const router = useRouter();
  const [sorot, setSorot] = useState(false);
  const [komentar, setKomentar] = useState(false);

  const laporan: Laporan = {
    id: b.id,
    gambar: b.gambar ?? b.poster,
    video: b.video ?? undefined,
    galeri: b.media
      .filter((m) => (m.jenis === "gambar" || m.jenis === "video") && m.url)
      .map((m) => ({ url: m.url, jenis: m.jenis, poster: m.poster })),
    alt: b.alt,
    judul: b.judul,
    tanggal: b.tanggal,
    lokasi: b.lokasi ?? b.provinsi,
    deskripsi: b.deskripsi,
    slug: b.slug,
    href: b.slug ? `/${bahasa}/fire/${b.slug}` : `/${bahasa}`,
  };

  const kembali = useCallback(() => {
    setSorot(false);
    setKomentar(false);
    router.back();
  }, [router]);

  const tab = "cursor-pointer rounded-full p-2 text-[#f5f5f5] transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-[#ff5a26]";

  return (
    <div className="min-h-dvh bg-[#0a0a0a] text-[#f5f5f5] antialiased">
      <TampilanPostingan
        laporan={laporan}
        bahasa={bahasa}
        statis
        onTutup={kembali}
        onBuka={() => setSorot(true)}
        onKomentar={() => setKomentar(true)}
      />
      {komentar && (
        <LembarKomentar id={b.id} bahasa={bahasa} onTutup={() => setKomentar(false)} />
      )}
      {sorot && (
        <RincianLaporan berita={b} bahasa={bahasa} onTutup={() => setSorot(false)} gelap />
      )}
      <nav aria-label={bahasa === "en" ? "Report pages" : "Halaman laporan"} className="lk-tabbar">
        <Link href={`/${bahasa}`} aria-label={bahasa === "en" ? "Home" : "Beranda"} className={tab}>
          <IkonBeranda />
        </Link>
        <Link href={`/${bahasa}/karhutla`} aria-label={bahasa === "en" ? "Open report list" : "Buka daftar laporan"} className={tab}>
          <IkonUmpan />
        </Link>
        <Link href={`/${bahasa}/lapor`} aria-label={bahasa === "en" ? "Report form" : "Formulir lapor"} className={tab}>
          <IkonTulis />
        </Link>
      </nav>
      <div aria-hidden="true" className="lk-tabbar-ruang" />
    </div>
  );
}
