"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import type { Bahasa } from "@/lib/bahasa";
import type { Berita } from "@/lib/events";
import { RincianLaporan } from "@/components/rincian-laporan";
import { SakelarTema } from "@/components/sakelar-tema";
import {
  TampilanPostingan, LembarKomentar,
  IkonBeranda, IkonUmpan, IkonTulis,
  type Laporan,
} from "@/components/landing-karhutla";

const langgananKosong = () => () => {};

/** Isi halaman detail gambar seluler: Nav + Postingan mengalir + bilah tab,
 *  dengan tumpukan overlay yang sama seperti di umpan (lembar opsi, lembar
 *  komentar, pop-up rincian). */
export function HalamanPostingan({ berita: b, bahasa, sebelumnya, berikutnya }: {
  berita: Berita;
  bahasa: Bahasa;
  /** Postingan tetangga ala Instagram — hanya yang punya slug bisa ditaut. */
  sebelumnya?: { slug: string };
  berikutnya?: { slug: string };
}) {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const mounted = useSyncExternalStore(langgananKosong, () => true, () => false);
  const [sorot, setSorot] = useState(false);
  const [komentar, setKomentar] = useState(false);

  const temaGelap = mounted ? resolvedTheme === "dark" : false;

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
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(`/${bahasa}`);
    }
  }, [router, bahasa]);

  const tab = "cursor-pointer rounded-full p-2 text-tinta/70 hover:text-tinta hover:bg-black/5 dark:text-[#f5f5f5] dark:hover:bg-white/10 transition focus-visible:outline-2 focus-visible:outline-[#ff5a26]";

  return (
    <div className="min-h-dvh bg-white text-tinta dark:bg-[#0a0a0a] dark:text-[#f5f5f5] antialiased transition-colors duration-200">
      <style>{`
        /* Adaptasi TampilanPostingan untuk mode terang dan gelap */
        html:not(.dark) .lk-postingan--statis {
          background: transparent !important;
          color: var(--color-tinta) !important;
        }
        html:not(.dark) .lk-postingan--statis .lk-postingan-penulis {
          color: var(--color-tinta);
        }
        html:not(.dark) .lk-postingan--statis .lk-postingan-kembali {
          color: var(--color-tinta) !important;
        }
        html:not(.dark) .lk-postingan--statis .lk-postingan-kembali:hover {
          background: rgba(0, 0, 0, 0.06) !important;
        }
        html:not(.dark) .lk-postingan--statis .lk-postingan-avatar {
          background: rgba(0, 0, 0, 0.05);
          border: 1px solid rgba(0, 0, 0, 0.08);
        }
        html:not(.dark) .lk-postingan--statis .lk-postingan-nama {
          color: var(--color-tinta);
        }
        html:not(.dark) .lk-postingan--statis .lk-postingan-lokasi {
          color: rgba(26, 25, 25, 0.65);
        }
        html:not(.dark) .lk-postingan--statis .lk-postingan-media {
          background: #eef1f4;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
        }
        html:not(.dark) .lk-postingan--statis .lk-postingan-aksi {
          color: var(--color-tinta);
        }
        html:not(.dark) .lk-postingan--statis .lk-postingan-ikon {
          color: var(--color-tinta) !important;
        }
        html:not(.dark) .lk-postingan--statis button.lk-postingan-ikon:hover {
          background: rgba(0, 0, 0, 0.06);
        }
        html:not(.dark) .lk-postingan--statis .lk-postingan-caption {
          color: var(--color-tinta);
        }
        html:not(.dark) .lk-postingan--statis .lk-postingan-caption-judul {
          color: var(--color-tinta);
        }
        html:not(.dark) .lk-postingan--statis .lk-postingan-caption-isi {
          color: rgba(26, 25, 25, 0.88);
        }
        html:not(.dark) .lk-postingan--statis .lk-postingan-selengkapnya {
          color: rgba(26, 25, 25, 0.55);
        }
        html:not(.dark) .lk-postingan--statis .lk-postingan-tanggal {
          color: rgba(26, 25, 25, 0.55);
        }
        html:not(.dark) .lk-tabbar {
          background: rgba(255, 255, 255, 0.95);
          border-top: 1px solid rgba(0, 0, 0, 0.08);
        }
      `}</style>
      <TampilanPostingan
        laporan={laporan}
        bahasa={bahasa}
        statis
        onTutup={kembali}
        onBuka={() => setSorot(true)}
        onKomentar={() => setKomentar(true)}
        onPrev={sebelumnya ? () => router.push(`/${bahasa}/fire/${sebelumnya.slug}`) : undefined}
        onNext={berikutnya ? () => router.push(`/${bahasa}/fire/${berikutnya.slug}`) : undefined}
      />
      {komentar && (
        <LembarKomentar id={b.id} bahasa={bahasa} onTutup={() => setKomentar(false)} />
      )}
      {sorot && (
        <RincianLaporan
          berita={b}
          bahasa={bahasa}
          onTutup={() => setSorot(false)}
          gelap={temaGelap}
          onSebelumnya={sebelumnya ? () => router.push(`/${bahasa}/fire/${sebelumnya.slug}`) : undefined}
          onBerikutnya={berikutnya ? () => router.push(`/${bahasa}/fire/${berikutnya.slug}`) : undefined}
          adaSebelumnya={!!sebelumnya}
          adaBerikutnya={!!berikutnya}
        />
      )}
      <nav aria-label={bahasa === "en" ? "Report pages" : "Halaman laporan"} className="lk-tabbar bg-white/95 border-t border-black/[0.08] dark:bg-[#0a0a0a] dark:border-white/[0.08] backdrop-blur-md">
        <Link href={`/${bahasa}`} aria-label={bahasa === "en" ? "Home" : "Beranda"} className={tab}>
          <IkonBeranda />
        </Link>
        <Link href={`/${bahasa}/karhutla`} aria-label={bahasa === "en" ? "Open report list" : "Buka daftar laporan"} className={tab}>
          <IkonUmpan />
        </Link>
        <Link href={`/${bahasa}/lapor`} aria-label={bahasa === "en" ? "Report form" : "Formulir lapor"} className={tab}>
          <IkonTulis />
        </Link>
        <SakelarTema bahasa={bahasa} />
      </nav>
      <div aria-hidden="true" className="lk-tabbar-ruang" />
    </div>
  );
}
