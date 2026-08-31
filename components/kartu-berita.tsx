"use client";

import { SliderKartu } from "./slider-kartu";
import type { Kartu } from "@/hooks/gunakan-korsel";

// Geometri dan rupa dipecah karena varian video butuh pembungkus ber-posisi
// (tempat lencana durasi duduk) sedangkan fotonya tidak. Foto dan video tetap
// menempati kotak yang sama persis — hanya pada video kotaknya dipegang
// pembungkus.
const KOTAK_LANSKAP =
  "mt-[var(--gambar-jarak)] aspect-[3/2] h-auto max-h-[var(--gambar-tinggi-maks)] " +
  "w-[var(--gambar-lebar)] self-center aliran:aspect-auto aliran:min-h-0 aliran:flex-1";
const RUPA_LANSKAP =
  "rounded-[10px] object-cover ring-1 ring-black/[0.08] shadow-[0_8px_20px_rgb(0_0_0/0.2)] " +
  "transition-[filter] duration-[550ms]";
const MEDIA_VERTIKAL =
  "kartu-media absolute inset-0 h-full w-full object-cover transition-[filter] duration-[550ms]";

type Props = {
  k: Kartu;
  aktif: boolean;
  kurangiGerak: boolean;
  onPilih: () => void;
  onBuka: () => void;
  onGeserMedia: () => void;
};

export function KartuBerita({ k, aktif, kurangiGerak, onPilih, onBuka, onGeserMedia }: Props) {
  const { isi } = k;
  // Kejadian tanpa media apa pun tetap punya satu foto bawaan lewat `gambar`.
  const media = isi.media.length > 0 ? isi.media : [{ jenis: "gambar" as const, url: isi.gambar }];

  return (
    <article
      onClick={onPilih}
      aria-hidden={!aktif}
      className={[
        aktif ? "z-10 opacity-100 translate-y-[6px] scale-[1.0557]" : "opacity-45",
        // Penanda "sudah diam di tengah" — kaitan css/kartu-kursor.css, yang
        // memberi kursor pointer hanya saat penunjuk benar-benar di atas media
        // kartu tengah.
        aktif ? "kartu-hidup" : "",
        isi.vertikal
          ? "bg-[#f5f5f5] overflow-hidden shadow-[0_10px_30px_rgb(0_0_0/0.28)]"
          : aktif
            ? "bg-white/[0.88] shadow-[10px_12px_28px_rgb(0_0_0/0.32)]"
            : "bg-white/90 shadow-[6px_6px_14px_rgb(0_0_0/0.22)]",
        "relative flex h-[var(--kartu-tinggi)] w-[var(--kartu-lebar)] shrink-0",
        "flex-col rounded-[12px] p-[var(--kartu-pias)] text-center",
        "ring-1 ring-white/60 backdrop-blur-[7px]",
        "transition-[transform,opacity,background-color]",
        "duration-[550ms] ease-[cubic-bezier(0.4,0,0.2,1)] will-change-transform",
      ].join(" ")}
    >
      {isi.vertikal ? (
        // Varian vertikal: foto memenuhi bingkai, judul lalu tanggal menumpang
        // putih di bagian bawahnya. Nama pulau tidak lagi ditampilkan di kartu.
        <div className="kartu-bingkai absolute inset-[var(--kartu-pias)] overflow-hidden rounded-[8px]">
          <div aria-hidden="true" className="absolute inset-0 bg-white" />

          <SliderKartu media={media} poster={isi.poster} label={isi.alt} aktif={aktif}
                       kurangiGerak={kurangiGerak} kelasMedia={MEDIA_VERTIKAL}
                       onBuka={onBuka} onGeser={onGeserMedia} />

          {/* pointer-events-none: gradasi & blok teks menumpang di ATAS foto,
              jadi keduanya menyerap klik sebelum sampai ke gambar. */}
          <div aria-hidden="true"
               className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgb(0_0_0/0.32)_0%,transparent_34%,transparent_50%,rgb(0_0_0/0.62)_100%)]" />
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-end p-[var(--kartu-pias)] text-left text-white">
            <p onClick={(e) => { e.stopPropagation(); onBuka(); }}
               className="pointer-events-auto cursor-pointer text-[clamp(14px,3.4vw,20px)] leading-[1.2] font-bold">
              {isi.judul}
            </p>
            <p className="mt-2 text-[length:var(--ukuran-tanggal)] leading-[1.2] font-normal opacity-90">
              • {isi.tanggal} •
            </p>
          </div>
        </div>
      ) : (
        // Varian bawaan: kartu kaca putih, judul & tanggal rata tengah di atas,
        // foto 3:2 di bawah.
        <>
          <p onClick={(e) => { e.stopPropagation(); onBuka(); }}
             className="w-full cursor-pointer text-center text-[clamp(16px,4.2vw,24px)] leading-[1.2] font-bold text-black">
            {isi.judul}
          </p>
          <p className="mt-4 w-full text-center text-[length:var(--ukuran-tanggal)] leading-[1.2] font-normal">
            • {isi.tanggal} •
          </p>
          <div aria-hidden="true" className="flex-1 aliran:hidden" />

          {/* Kotaknya selalu pembungkus ber-posisi, juga untuk foto: titik
              navigasi slider duduk di atasnya. */}
          <div className={`kartu-bingkai relative ${KOTAK_LANSKAP}`}>
            <SliderKartu media={media} poster={isi.poster} label={isi.alt} aktif={aktif}
                         kurangiGerak={kurangiGerak}
                         kelasMedia={`kartu-media absolute inset-0 h-full w-full ${RUPA_LANSKAP}`}
                         onBuka={onBuka} onGeser={onGeserMedia} />
          </div>
        </>
      )}
    </article>
  );
}
