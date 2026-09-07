"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import { VideoKartu } from "./video-kartu";
import { mediaLokal, type ItemMedia } from "@/lib/media";

type Props = {
  media: ItemMedia[];
  /** Poster untuk tiap video kartu — thumbnail kejadian, bukan per media. */
  poster: string | null;
  label: string;
  /** Kartu ini sedang di tengah? Hanya yang tengah yang diputar & bisa diklik. */
  aktif: boolean;
  kurangiGerak: boolean;
  /** Kelas untuk elemen media; sama untuk foto dan video agar kotaknya identik. */
  kelasMedia: string;
  onBuka: () => void;
  /** Dipanggil saat titik ditekan — memundurkan hitungan geser otomatis korsel
   *  supaya media yang baru dipilih tidak langsung tergeser. */
  onGeser: () => void;
};

/**
 * Slider media pada satu kartu korsel.
 *
 * Hanya media yang sedang ditunjuk yang dirender. Di Alpine seluruh media
 * dipasang bersamaan lalu disembunyikan dengan x-show — dan itulah sumber
 * bug-nya: `x-show` tidak menjeda <video>, jadi semua video satu kartu berjalan
 * sekaligus, ikut mengunduh berkasnya dan ikut memicu `ended`. Di sini yang
 * tersembunyi memang tidak ada di DOM, jadi persoalannya tidak bisa muncul.
 */
export function SliderKartu({
  media, poster, label, aktif, kurangiGerak, kelasMedia, onBuka, onGeser,
}: Props) {
  // Indeks bertahan per kartu, seperti map indeksMedia[kunci] di Alpine: kartu
  // yang tergeser keluar lalu kembali menampilkan media yang tadi dipilih.
  const [indeks, setIndeks] = useState(0);

  // Galeri bisa menyusut saat data dimuat ulang; indeks yang tertinggal di luar
  // batas akan merender undefined.
  const kini = indeks < media.length ? indeks : 0;

  const m = media[kini];
  if (!m) return null;

  return (
    <>
      {m.jenis === "video" ? (
        // key: media berganti berarti elemen video berganti, bukan sekadar
        // src-nya. Tanpa itu React memakai ulang elemen yang sama dan lencana
        // durasi milik media sebelumnya sempat terbawa.
        // Poster per-media (bingkai videonya sendiri) menang atas thumbnail
        // kejadian — kartu multi-video tidak berbagi satu gambar yang salah.
        <VideoKartu key={`v${kini}`} src={m.url} poster={m.poster ?? poster} label={label} aktif={aktif}
                    kurangiGerak={kurangiGerak} className={kelasMedia} onBuka={onBuka} />
      ) : (
        <FotoKartu key={`g${kini}`} src={m.url} alt={label} aktif={aktif}
                   className={kelasMedia} onBuka={onBuka} />
      )}

      {media.length > 1 && (
        <TitikMedia
          jumlah={media.length}
          kini={kini}
          onPilih={(i) => {
            setIndeks(i);
            onGeser();
          }}
        />
      )}
    </>
  );
}

function FotoKartu({
  src,
  alt,
  aktif,
  className,
  onBuka,
}: {
  src: string;
  alt: string;
  aktif: boolean;
  className: string;
  onBuka: () => void;
}) {
  const [fotoSiap, setFotoSiap] = useState(false);

  /* Foto yang sudah di tembolok peramban sudah `complete` sejak elemennya
     dipasang, dan onLoad TIDAK dijamin menyala lagi untuknya. Tanpa cek ini
     setiap remount memasang kerangka dulu — dan kartu memang di-mount ulang
     serentak begitu daftar berita berubah (mis. kejadian baru masuk lewat
     penyegar otomatis), sehingga semua foto berkedip putih bersamaan.
     Ref callback berjalan sebelum paint, jadi kerangkanya tidak sempat
     terlihat. */
  const pasangFoto = useCallback((el: HTMLImageElement | null) => {
    if (el?.complete) setFotoSiap(true);
  }, []);

  return (
    <>
      {mediaLokal(src) ? (
        /* Unggahan lokal lewat optimizer next/image: srcset mengikuti lebar
           kartu (78vw ponsel, ~526px panggung) alih-alih mengirim JPEG orisinal
           multi-MB, dan AVIF/WebP bila peramban mendukung. Kartu tengah diunggak
           segera + fetchPriority tinggi (ia kandidat LCP); kartu salinan di luar
           jendela korsel menunggu sampai terlihat — tanpa ini tiga puluh foto
           orisinal turun serentak begitu hidrasi. */
        <Image
          ref={pasangFoto}
          src={src}
          alt={alt}
          fill
          sizes="(max-width: 1099px) 78vw, 526px"
          loading={aktif ? "eager" : "lazy"}
          fetchPriority={aktif ? "high" : undefined}
          onLoad={() => setFotoSiap(true)}
          onError={() => setFotoSiap(true)}
          onClick={(e) => {
            if (aktif) {
              e.stopPropagation();
              onBuka();
            }
          }}
          className={`${className} ${aktif ? "grayscale-0" : "grayscale-[0.65]"}`}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- URL media remote warisan, host dinamis di luar remotePatterns
        <img
          ref={pasangFoto}
          src={src}
          alt={alt}
          loading={aktif ? "eager" : "lazy"}
          decoding="async"
          onLoad={() => setFotoSiap(true)}
          onError={() => setFotoSiap(true)}
          onClick={(e) => {
            if (aktif) {
              e.stopPropagation();
              onBuka();
            }
          }}
          className={`${className} ${aktif ? "grayscale-0" : "grayscale-[0.65]"}`}
        />
      )}
      <div aria-hidden="true" className={`kartu-kerangka ${fotoSiap ? "tutup" : ""}`} />
    </>
  );
}

/**
 * Titik penunjuk posisi media pada kartu.
 *
 * Bentuknya sama di semua lebar; yang berbeda hanya ukurannya. Di ponsel kotak
 * sentuhnya 24px (batas bawah WCAG 2.5.8), di layar lebar 28px.
 *
 * Kartu dengan lebih dari 13 media kembali ke 20px: 24px × 13 = 312px sudah
 * memenuhi kartu ponsel (~312px), jadi menahannya di atas itu membuat baris
 * titik meluber keluar kartu. Untuk kartu sesepadat itu berlaku pengecualian
 * "Equivalent" WCAG 2.5.8 — fungsi yang sama tersedia lewat pop-up rincian,
 * yang titiknya tetap 24px dan masih ditemani panah kiri-kanan berukuran
 * penuh.
 */
function TitikMedia({
  jumlah,
  kini,
  onPilih,
}: {
  jumlah: number;
  kini: number;
  onPilih: (i: number) => void;
}) {
  const padat = jumlah > 13;
  return (
    <div
      className="absolute bottom-1.5 left-1/2 z-20 flex -translate-x-1/2 items-center"
      role="group"
      aria-label={`Media ${kini + 1} dari ${jumlah}`}
    >
      {Array.from({ length: jumlah }, (_, i) => (
        <button
          key={i}
          type="button"
          aria-label={`Media ${i + 1} dari ${jumlah}`}
          aria-current={i === kini}
          onClick={(e) => {
            e.stopPropagation();
            onPilih(i);
          }}
          className={`flex items-center justify-center p-0.5 ${
            padat ? "min-h-[20px] min-w-[20px]" : "min-h-[24px] min-w-[24px]"
          } sm:min-h-[28px] sm:min-w-[28px] sm:p-1`}
        >
          <span
            aria-hidden="true"
            className={`block h-[5px] w-[5px] rounded-full transition-all sm:h-2 sm:w-2 ${
              i === kini ? "scale-110 bg-white" : "bg-white/50 hover:bg-white/75"
            }`}
          />
        </button>
      ))}
    </div>
  );
}
