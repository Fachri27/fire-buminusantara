"use client";

import Link from "next/link";
import { SliderKartu } from "./slider-kartu";
import type { Kartu } from "@/hooks/gunakan-korsel";
import type { Bahasa } from "@/lib/bahasa";

// Geometri dan rupa dipecah karena varian video butuh pembungkus ber-posisi
// (tempat lencana durasi duduk) sedangkan fotonya tidak. Foto dan video tetap
// menempati kotak yang sama persis — hanya pada video kotaknya dipegang
// pembungkus.
const KOTAK_LANSKAP =
  "mt-[var(--gambar-jarak)] aspect-[3/2] h-auto max-h-[var(--gambar-tinggi-maks)] " +
  "w-[var(--gambar-lebar)] self-center aliran:aspect-auto aliran:min-h-0 aliran:flex-1";
const RUPA_LANSKAP =
  "rounded-[10px] object-cover ring-1 ring-black/[0.08] dark:ring-white/10 shadow-[0_8px_20px_rgb(0_0_0/0.15)] dark:shadow-[0_8px_20px_rgb(0_0_0/0.4)]";
const MEDIA_VERTIKAL =
  "kartu-media absolute inset-0 h-full w-full object-cover";

type Props = {
  k: Kartu;
  aktif: boolean;
  kurangiGerak: boolean;
  bahasa?: Bahasa;
  onPilih: () => void;
  onBuka: () => void;
  onGeserMedia: () => void;
};

export function KartuBerita({ k, aktif, kurangiGerak, bahasa = "id", onPilih, onBuka, onGeserMedia }: Props) {
  const { isi } = k;
  // Kejadian tanpa media apa pun tidak lagi menampilkan foto dummy — kotak
  // medianya diganti petunjuk pola lokasi. `SliderKartu` mengembalikan null
  // untuk galeri kosong, jadi placeholder dipakai cukup di sini.
  const media = isi.media;
  const punyaMedia = media.length > 0;

  // Tanpa backdrop-blur dan tanpa transition filter: keduanya memaksa
  // Chromium mengambil ulang foto latar tiap bingkai selama animasi 550ms
  // (putar otomatis tiap 6 detik) — sumber kedipan di Chrome.
  return (
    <article
      onClick={onPilih}
      aria-hidden={!aktif}
      className={[
        aktif ? "z-10 opacity-100 translate-y-[6px] scale-[1.0557]" : "opacity-45 cursor-pointer",
        // Penanda "sudah diam di tengah" — kaitan css/kartu-kursor.css, yang
        // memberi kursor pointer hanya saat penunjuk benar-benar di atas media
        // kartu tengah.
        aktif ? "kartu-hidup" : "",
        isi.vertikal
          ? "bg-white dark:bg-white/[0.05] border border-black/[0.06] dark:border-white/10 overflow-hidden shadow-sm dark:shadow-[0_10px_30px_rgb(0_0_0/0.35)] text-tinta dark:text-white"
          : aktif
            ? "bg-white dark:bg-white/[0.05] border border-black/[0.06] dark:border-white/10 shadow-sm dark:shadow-[10px_12px_28px_rgb(0_0_0/0.32)] text-tinta dark:text-white"
            : "bg-white/95 dark:bg-white/[0.05] border border-black/[0.06] dark:border-white/10 shadow-sm dark:shadow-[6px_6px_14px_rgb(0_0_0/0.22)] text-tinta dark:text-white",
        "relative flex h-[var(--kartu-tinggi)] w-[var(--kartu-lebar)] shrink-0",
        "flex-col rounded-[12px] p-[var(--kartu-pias)] text-center",
        "transition-[transform,opacity,background-color,border-color,box-shadow]",
        "duration-[550ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
      ].join(" ")}
    >
      {isi.vertikal ? (
        // Varian vertikal: foto memenuhi bingkai, judul lalu tanggal menumpang
        // putih di bagian bawahnya. Nama pulau tidak lagi ditampilkan di kartu.
        <div className="kartu-bingkai absolute inset-[var(--kartu-pias)] overflow-hidden rounded-[8px] border border-black/[0.06] dark:border-white/10">
          <div aria-hidden="true" className="absolute inset-0 bg-white dark:bg-pantau-konsol" />

          {punyaMedia ? (
            <SliderKartu media={media} poster={isi.poster} label={isi.alt} aktif={aktif}
                         kurangiGerak={kurangiGerak} kelasMedia={MEDIA_VERTIKAL}
                         onBuka={onBuka} onGeser={onGeserMedia} />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-black/[0.04] dark:bg-[linear-gradient(150deg,#242424,#1a1a1a)]">
              <span className="rounded-full bg-white/70 dark:bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-black/45 dark:text-white/60 border border-black/[0.05] dark:border-white/10">
                {isi.pulau || "Belum ada foto"}
              </span>
            </div>
          )}

          {/* pointer-events-none: gradasi & blok teks menumpang di ATAS foto,
              jadi keduanya menyerap klik sebelum sampai ke gambar. */}
          <div aria-hidden="true"
               className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgb(0_0_0/0.25)_0%,transparent_34%,transparent_50%,rgb(0_0_0/0.65)_100%)] dark:bg-[linear-gradient(to_bottom,rgb(0_0_0/0.4)_0%,transparent_34%,transparent_50%,rgb(0_0_0/0.82)_100%)]" />
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-end p-[var(--kartu-pias)] text-left text-white">
            <h2 className="contents">
              <Link
                href={isi.slug ? `/${bahasa}/fire/${isi.slug}` : `/${bahasa}`}
                // href-nya untuk crawler dan klik-tengah; navigasi in-app
                // sengaja lewat pop-up di bawah, jadi rute tujuannya tidak
                // pernah benar-benar dikunjungi dari sini. Memprefetch-nya
                // hanya membuang kerja server per kartu.
                prefetch={false}
                onClick={(e) => {
                  // Allow middle click / ctrl click / cmd click to open in new tab naturally
                  if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                    e.preventDefault();
                    e.stopPropagation();
                    onBuka();
                  }
                }}
                className="pointer-events-auto cursor-pointer text-[clamp(14px,3.4vw,20px)] leading-[1.2] font-bold text-white no-underline drop-shadow-sm hover:underline"
              >
                {isi.judul}
              </Link>
            </h2>
            <p className="mt-2 text-[length:var(--ukuran-tanggal)] leading-[1.2] font-normal text-white/90 drop-shadow-sm">
              • {isi.tanggal} •
            </p>
          </div>
        </div>
        ) : (
        // Varian bawaan: kartu kaca putih, judul & tanggal dipusatkan pada
        // ruang di atas foto. Pembungkusnya yang mengambil sisa ruang — judul
        // yang melipat beberapa baris tetap di tengah, bukan menempel di atas
        // kartu. Di mode aliran pembungkusnya kembali setinggi isi, sebab
        // kotak medianya sendiri yang meregang (aliran:flex-1).
        <>
          <div className="flex w-full flex-1 flex-col items-center justify-center aliran:flex-none">
            <h2 className="contents">
              <Link
                href={isi.slug ? `/${bahasa}/fire/${isi.slug}` : `/${bahasa}`}
                // href-nya untuk crawler dan klik-tengah; navigasi in-app
                // sengaja lewat pop-up di bawah, jadi rute tujuannya tidak
                // pernah benar-benar dikunjungi dari sini. Memprefetch-nya
                // hanya membuang kerja server per kartu.
                prefetch={false}
                onClick={(e) => {
                  // Allow middle click / ctrl click / cmd click to open in new tab naturally
                  if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                    e.preventDefault();
                    e.stopPropagation();
                    onBuka();
                  }
                }}
                className="w-full cursor-pointer text-center text-[clamp(16px,4.2vw,24px)] leading-[1.2] font-bold text-tinta dark:text-white no-underline transition-colors hover:text-api dark:hover:text-api"
              >
                {isi.judul}
              </Link>
            </h2>
            <p className="mt-4 w-full text-center text-[length:var(--ukuran-tanggal)] leading-[1.2] font-normal text-tinta/70 dark:text-white/70 transition-colors">
              • {isi.tanggal} •
            </p>
          </div>

          {/* Kotaknya selalu pembungkus ber-posisi, juga untuk foto: titik
              navigasi slider duduk di atasnya. */}
          <div className={`kartu-bingkai relative ${KOTAK_LANSKAP}`}>
            {punyaMedia ? (
              <SliderKartu media={media} poster={isi.poster} label={isi.alt} aktif={aktif}
                           kurangiGerak={kurangiGerak}
                           kelasMedia={`kartu-media absolute inset-0 h-full w-full ${RUPA_LANSKAP}`}
                           onBuka={onBuka} onGeser={onGeserMedia} />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center rounded-[10px] bg-black/[0.04] dark:bg-[linear-gradient(150deg,#242424,#1a1a1a)] ring-1 ring-black/[0.08] dark:ring-white/10">
                <span className="rounded-full bg-white/70 dark:bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-black/45 dark:text-white/60 border border-black/[0.05] dark:border-white/10">
                  {isi.pulau || "Belum ada foto"}
                </span>
              </div>
            )}
          </div>
        </>
      )}
    </article>
  );
}
