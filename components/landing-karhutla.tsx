"use client";

import { useActionState, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Peta } from "@/components/peta";
import { Nav } from "@/components/nav";
import { RincianLaporan } from "@/components/rincian-laporan";
import { gunakanKolomUmpan } from "@/hooks/gunakan-kolom-umpan";
import { BATAS_BERKAS, BATAS_TOTAL_BYTE } from "@/lib/batas-laporan";
import { KUNCI_SOROTAN, LABEL_SOROTAN, type KunciSorotan } from "@/lib/statistik-sorotan-teks";
import type { Bahasa } from "@/lib/bahasa";
import type { Berita } from "@/lib/events";
import { kirimLaporan, type KeadaanLapor } from "@/app/[locale]/lapor/aksi";

/** Site key Turnstile — sama seperti form /lapor. */
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

/* Jenis berkas ditulis satu per satu, BUKAN "image/*,video/*" — sama seperti
   form /lapor: dengan daftar eksplisit, iOS mengubah foto HEIC-nya jadi JPEG
   saat dipilih sehingga lolos pemeriksaan MIME di server. */
const DITERIMA = "image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm";

type TurnstileInstance = {
  render: (wadah: HTMLElement, opsi: Record<string, unknown>) => number;
  reset: (id: number) => void;
  remove: (id: number | null) => void;
};

function turnstile(): TurnstileInstance | null {
  return (window as Window & { turnstile?: TurnstileInstance }).turnstile ?? null;
}

/** Dua berkas dianggap sama kalau nama, ukuran, dan waktu ubahnya sama. */
function kunciBerkas(b: File): string {
  return `${b.name}|${b.size}|${b.lastModified}`;
}

type Laporan = {
  id: number;
  gambar: string | null; // foto — atau poster bingkai bila laporannya video
  video?: string; // mp4 bila laporannya video
  alt: string;
  judul: string;
  tanggal: string;
  href: string;
};

const STATISTIK: { kunci: KunciSorotan; id: string; en: string }[] = KUNCI_SOROTAN.map((kunci) => ({
  kunci,
  ...LABEL_SOROTAN[kunci],
}));

const TEKS = {
  id: {
    // Judul penuh halaman — dipakai H1 sr-only; judul pendek + tombol lapor
    // kini milik <Nav gelap> yang dipakai bersama halaman index.
    judul: "Kebakaran Hutan dan Lahan",
    cariLaporan: "Lapor apa yang kamu lihat",
    lokasi: "Kalimantan Barat",
    lokasiOtomatis: "secara otomatis dibaca lokasi",
    petaJudul: "Aerosol Karhutla",
    petaAngin: "Angin dan kualitas udara",
    petaWaktu: "8 Sep, 00:00 WIB",
    petaLegenda: "Kepekatan aerosol asap kebakaran, dibaca dari satelit Sentinel-5P.",
    petaTipis: "Tipis",
    petaPekat: "Pekat",
    kaki: "Laporan warga terkurasi sebelum ditampilkan. Menyaksikan kebakaran atau dampak asapnya? Ceritakan di kotak laporan.",
    merek: "©2026 Lapor Karhutla",
    hasilKosong: "Tidak ada laporan yang cocok. Coba kata lain, atau kirim laporanmu sendiri.",
    umpan: "Laporan warga",
    situasi: "Panel situasi",
    mainkan: "Mainkan rekaman sebaran",
    tulis: "Apa yang terjadi di sekitarmu?",
    kirim: "Kirim",
    lampirFoto: "Lampirkan foto",
    lampirVideo: "Lampirkan video",
    tandaiLokasi: "Tandai lokasi",
    judulPh: "Judul singkat laporannya",
    ceritaPh: "Ceritakan yang kamu lihat…",
    judulWajib: "Isi judul singkat dulu.",
    ceritaWajib: "Ceritakan kejadiannya sedikit.",
    berkasWajib: "Sertakan minimal satu foto atau video.",
    lokasiOk: "Lokasi ditandai",
    lokasiGagal: "Lokasi gagal dibaca.",
    mencariLokasi: "Mencari…",
    terkirim: "Laporan terkirim.",
    terkirimIsi: "Terima kasih — laporanmu sedang diverifikasi dan akan tampil di beranda setelah lolos kurasi.",
    tulisLagi: "Tulis lagi",
    batal: "Batal",
    mengirim: "Mengirim…",
    memverifikasi: "Memverifikasi…",
    keamananGagal: "Pemeriksaan keamanan gagal dimuat. Periksa koneksi lalu coba lagi.",
    terlaluBanyak: "Maksimal 6 berkas per laporan.",
    terlaluBesar: "Total berkas terlalu besar.",
    suhuMenunggu: "Suhu sedang dimuat",
    bukaPetaSelayar: "Buka peta selayar",
    tutupPetaSelayar: "Tutup peta selayar",
    namaPh: "Nama (opsional)",
    anonim: "Anonim",
    latPh: "Lat",
    lngPh: "Lng",
    tabBeranda: "Beranda",
    tabCari: "Cari laporan",
    tabTulis: "Tulis laporan",
    tabLapor: "Formulir lapor",
    tabPanel: "Buka panel situasi",
    tabUmpan: "Buka daftar laporan",
    titikMenu: "Opsi laporan",
    lembarBuka: "Buka laporan",
    lembarBagikan: "Bagikan",
    lembarUnduh: "Unduh gambar",
    lembarTersalin: "Tautan tersalin",
    lembarTutup: "Tutup",
  },
  en: {
    judul: "Forest and Land Fires",
    cariLaporan: "Report what you see",
    lokasi: "West Kalimantan",
    lokasiOtomatis: "location read automatically",
    petaJudul: "Wildfire Aerosol",
    petaAngin: "Wind and air quality",
    petaWaktu: "8 Sep, 00:00 WIB",
    petaLegenda: "Smoke aerosol density, read from the Sentinel-5P satellite.",
    petaTipis: "Thin",
    petaPekat: "Dense",
    kaki: "Citizen reports are curated before they appear. Seeing a fire or its haze? Tell us in the report box.",
    merek: "©2026 Lapor Karhutla",
    hasilKosong: "No reports match that. Try other words, or send a report of your own.",
    umpan: "Citizen reports",
    situasi: "Situation panel",
    mainkan: "Play the spread recording",
    tulis: "What's happening around you?",
    kirim: "Post",
    lampirFoto: "Attach a photo",
    lampirVideo: "Attach a video",
    tandaiLokasi: "Tag location",
    judulPh: "Short report title",
    ceritaPh: "Describe what you see…",
    judulWajib: "Give it a short title first.",
    ceritaWajib: "Describe what happened, briefly.",
    berkasWajib: "Attach at least one photo or video.",
    lokasiOk: "Location tagged",
    lokasiGagal: "Could not read location.",
    mencariLokasi: "Locating…",
    terkirim: "Report sent.",
    terkirimIsi: "Thank you — your report is being verified and will appear on the homepage once approved.",
    tulisLagi: "Write another",
    batal: "Cancel",
    mengirim: "Sending…",
    memverifikasi: "Verifying…",
    keamananGagal: "Security check could not load. Check your connection and try again.",
    terlaluBanyak: "Maximum 6 files per report.",
    terlaluBesar: "Total files too large.",
    suhuMenunggu: "Loading temperature",
    bukaPetaSelayar: "Open fullscreen map",
    tutupPetaSelayar: "Close fullscreen map",
    namaPh: "Name (optional)",
    anonim: "Anonymous",
    latPh: "Lat",
    lngPh: "Lng",
    tabBeranda: "Home",
    tabCari: "Search reports",
    tabTulis: "Write report",
    tabLapor: "Report form",
    tabPanel: "Open situation panel",
    tabUmpan: "Open report list",
    titikMenu: "Report options",
    lembarBuka: "Open report",
    lembarBagikan: "Share",
    lembarUnduh: "Download image",
    lembarTersalin: "Link copied",
    lembarTutup: "Close",
  },
} satisfies Record<Bahasa, Record<string, string>>;

function IkonCari({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function IkonLokasi({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8"
         className={className}>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" />
    </svg>
  );
}

/** Ikon bentang 4-sudut — pasangan tombol X penutup. Sama seperti ikon
 *  buka-peta di halaman-peta.tsx, supaya bahasanya satu konsol. */
function IkonBentang({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4"
         strokeLinecap="round" className={className}>
      <path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" />
    </svg>
  );
}

function IkonTutup({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4"
         strokeLinecap="round" className={className}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

/**
 * Cuaca lokal pengunjung: lokasi + suhu dibaca otomatis dari IP, tanpa
 * meminta izin geolokasi browser.
 *
 * - Muat: judul lokasi menampilkan teks statis (Kalimantan Barat); suhu
 *   menampilkan garis jeda agar tak ada angka bohong sebelum data tiba.
 * - useEffect menembak /api/cuaca-lokal (IP -> kota via ipwho.is +
 *   BigDataCloud, suhu live via Open-Meteo) lalu state ditimpa.
 * - Gagal total: lokasi + suhu cadangan server (DKI Jakarta + suhu live
 *   Monas) - panel tak pernah kosong.
 *
 * Ikon: pakaian WMO weather_code Open-Meteo - 0 cerah (matahari/bulan), 1-3
 * berawan lipat tiga, 45/48 kabut, 51-67 gerimis/hujan, 71-77 salju, 80-82
 * hujan rintik, 95-99 badai petir.
 */
function useCuacaLokal(bahasa: Bahasa, lokasiAwal: string) {
  const [lokasi, setLokasi] = useState(lokasiAwal);
  const [suhu, setSuhu] = useState<number | null>(null);
  const [kodeCuaca, setKodeCuaca] = useState<number | null>(null);
  const [siang, setSiang] = useState(true);
  const [sumber, setSumber] = useState<"bmkg" | "model" | null>(null);

  useEffect(() => {
    let hidup = true;
    type Muatan = {
      nama?: unknown; suhu?: unknown; kodeCuaca?: unknown; siang?: unknown; sumber?: unknown;
    };
    const terapkan = (j: Muatan): void => {
      if (typeof j.nama === "string" && j.nama.trim() !== "") setLokasi(j.nama.trim());
      if (typeof j.suhu === "number" && Number.isFinite(j.suhu)) setSuhu(Math.round(j.suhu));
      if (typeof j.kodeCuaca === "number" && Number.isFinite(j.kodeCuaca)) setKodeCuaca(j.kodeCuaca);
      if (typeof j.siang === "boolean") setSiang(j.siang);
      if (j.sumber === "bmkg" || j.sumber === "model") setSumber(j.sumber);
    };
    // Cache lokal 15 menit: refresh langsung menampilkan angka terakhir
    // tanpa menunggu rantai server — lalu tetap divalidasi ulang di bawah.
    try {
      const mentah = window.localStorage.getItem(`lk-cuaca-${bahasa}`);
      if (mentah) {
        const { t, data } = JSON.parse(mentah) as { t: number; data: Muatan };
        if (data && typeof t === "number" && Date.now() - t < 15 * 60_000) terapkan(data);
      }
    } catch {
      /* cache rusak: abaikan, fetch segar di bawah */
    }
    // Rantai server (geo-IP + kota + adm4 + BMKG + cadangan) bisa >30 detik
    // saat dingin — sekali coba dengan batas 30 detik kerap gugur tepat di
    // garis finis dan panel macet di garis jeda. Batas 60 detik + sekali
    // ulangi bila gugur.
    const ambil = async (batas: number): Promise<boolean> => {
      try {
        const r = await fetch(`/api/cuaca-lokal?bahasa=${bahasa}`, {
          signal: AbortSignal.timeout(batas),
          headers: { Accept: "application/json" },
        });
        if (!r.ok) return false;
        const j = (await r.json()) as {
          nama?: unknown; suhu?: unknown; kodeCuaca?: unknown; siang?: unknown; sumber?: unknown;
        };
        if (!hidup) return true;
        terapkan(j);
        try {
          window.localStorage.setItem(`lk-cuaca-${bahasa}`, JSON.stringify({ t: Date.now(), data: j }));
        } catch {
          /* penyimpanan penuh/diblokir: abaikan */
        }
        return true;
      } catch {
        return false;
      }
    };
    (async () => {
      if (await ambil(60_000)) return;
      if (hidup) await ambil(60_000);
    })();
    return () => {
      hidup = false;
    };
  }, [bahasa]);

  return { lokasi, suhu, kodeCuaca, siang, sumber };
}

/** Ikon cuaca garis putih meniru IkonMatahari: matahari/bulan, awan, hujan, petir, kabut. */
function IkonCuaca({ kode, siang, className = "size-14" }: { kode: number | null; siang: boolean; className?: string }) {
  const g = (isi: string) => (
    <svg viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round" className={className}>
      <g dangerouslySetInnerHTML={{ __html: isi }} />
    </svg>
  );
  if (kode === null) return g('<circle cx="24" cy="24" r="9" /><path d="M24 4v5M24 39v5M4 24h5M39 24h5M10 10l3.5 3.5M34.5 34.5 38 38M38 10l-3.5 3.5M13.5 34.5 10 38" />');
  if (kode === 0) {
    return siang
      ? g('<circle cx="24" cy="24" r="9" /><path d="M24 4v5M24 39v5M4 24h5M39 24h5M10 10l3.5 3.5M34.5 34.5 38 38M38 10l-3.5 3.5M13.5 34.5 10 38" />')
      : g('<path d="M30 8a13 13 0 1 0 10 16A15 15 0 0 1 30 8Z" /><path d="M36 6v4M40 4v3" />');
  }
  if (kode <= 3) {
    return siang
      ? g('<circle cx="18" cy="18" r="6" /><path d="M18 6v3M6 18h3M9.5 9.5l2 2M26.5 9.5l-2 2" /><path d="M16 38h14a7 7 0 0 0 1.5-13.8A10 10 0 0 0 12 26a6.5 6.5 0 0 0 4 12Z" />')
      : g('<path d="M30 6a9 9 0 1 0 7 12A11 11 0 0 1 30 6Z" /><path d="M16 38h14a7 7 0 0 0 1.5-13.8A10 10 0 0 0 12 26a6.5 6.5 0 0 0 4 12Z" />');
  }
  if (kode === 45 || kode === 48) return g('<path d="M14 18h16a7 7 0 0 0 1.5-13.8A10 10 0 0 0 12 6a6.5 6.5 0 0 0 2 12Z" /><path d="M10 26h28M12 32h24M10 38h28" />');
  if ((kode >= 51 && kode <= 67) || (kode >= 80 && kode <= 82)) return g('<path d="M14 26h16a7 7 0 0 0 1.5-13.8A10 10 0 0 0 12 14a6.5 6.5 0 0 0 2 12Z" /><path d="M16 32l-2 5M24 32l-2 5M32 32l-2 5M40 32l-2 5" />');
  if (kode >= 71 && kode <= 77) return g('<path d="M14 24h16a7 7 0 0 0 1.5-13.8A10 10 0 0 0 12 12a6.5 6.5 0 0 0 2 12Z" /><path d="M17 30v.1M25 30v.1M33 30v.1M21 36v.1M29 36v.1M17 42v.1M25 42v.1M33 42v.1" />');
  return g('<path d="M14 24h16a7 7 0 0 0 1.5-13.8A10 10 0 0 0 12 12a6.5 6.5 0 0 0 2 12Z" /><path d="M24 28l-6 10h5l-2 6 8-12h-5l3-4h-3Z" />');
}


/* Ikon-ikon komposer ala X: garis tipis 1.8, ukuran seragam. */
function IkonFoto({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8"
         strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m5.5 18 5-5 3 3 2.5-2.5 2.5 2.5" />
    </svg>
  );
}

function IkonVideo({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8"
         strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="6" width="12" height="12" rx="2" />
      <path d="m15 10.5 6-3.5v10l-6-3.5" />
    </svg>
  );
}

function IkonPin({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8"
         className={className}>
      <path d="M12 21s-6.5-5.4-6.5-10.5a6.5 6.5 0 0 1 13 0C18.5 15.6 12 21 12 21Z" />
      <circle cx="12" cy="10.5" r="2.3" />
    </svg>
  );
}

function IkonOrang({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8"
         strokeLinecap="round" className={className}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </svg>
  );
}

/* Umpan masonry berkolom tetap — pola yang sama dengan MasonryKolom di index:
   kartu dibagi bergiliran (0,1,2,0,1,2…) ke sejumlah daftar terpisah, lalu
   daftar-daftar itu dijajar. Sengaja BUKAN CSS `columns`: di sana peramban
   yang memutuskan isi tiap kolom dan menghitung ulangnya setiap tinggi isi
   berubah — gambar yang baru termuat melempar kartu ke kolom lain. Di sini
   penempatan ditentukan indeks, jadi kekal: gambar yang telat hanya mendorong
   kartu di bawahnya dalam kolom yang sama. */
/* Seluler atau bukan — cerminan varian aliran/panggung di JS. Snapshot server
   sengaja panggung (kedua rel dirender) supaya markup SSR lengkap; klien
   seluler melepas rel kiri setelah hidrasi. Pola yang sama dengan
   gunakanKolomMasonry di index. */
function useAliran(): boolean {
  return useSyncExternalStore(
    (ubah) => {
      const mq = window.matchMedia("not all and (min-width: 1100px) and (min-height: 640px)");
      mq.addEventListener("change", ubah);
      return () => mq.removeEventListener("change", ubah);
    },
    () => window.matchMedia("not all and (min-width: 1100px) and (min-height: 640px)").matches,
    () => false,
  );
}

/* Video kartu umpan — pola yang sama dengan VideoKeping index: autoplay bisu
   berulang saat terlihat di layar (IntersectionObserver 25%), dijeda saat
   tidak; tanpa kontrol dan tanpa suara (kliknya membuka rincian); pengurang
   gerak berarti diam di poster. Poster di lapisan sendiri supaya kegagalan
   putar tak berarti kotak hitam. */
function VideoOtomatis({ url, poster, label, onBuka }: {
  url: string; poster: string | null; label: string; onBuka: () => void;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const terlihatRef = useRef(false);
  const [siap, setSiap] = useState(false);
  const [posterGagal, setPosterGagal] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Properti muted, bukan sekadar atribut — syarat autoplay peramban.
    el.muted = true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const amati = new IntersectionObserver(
      (masuk) => {
        terlihatRef.current = masuk.some((m) => m.isIntersecting);
        if (terlihatRef.current) el.play().catch(() => {});
        else el.pause();
      },
      { threshold: 0.25 },
    );
    amati.observe(el);
    return () => {
      amati.disconnect();
      el.pause();
    };
  }, []);

  const cobaPutar = useCallback((el: HTMLVideoElement) => {
    setSiap(true);
    if (terlihatRef.current) el.play().catch(() => {});
  }, []);

  return (
    <button
      type="button"
      onClick={onBuka}
      aria-label={label}
      className="lk-foto mt-3 block w-full transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff5a26] hover:brightness-95"
    >
      <span className="relative block">
        {poster && !posterGagal ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={poster} alt="" aria-hidden="true" loading="lazy"
              onError={() => setPosterGagal(true)}
              className="lk-foto h-auto w-full"
            />
            <video
              ref={ref}
              src={url}
              muted
              playsInline
              loop
              preload="metadata"
              onCanPlay={(e) => cobaPutar(e.currentTarget)}
              onPlaying={() => setSiap(true)}
              className={`lk-video absolute inset-0 h-full w-full object-cover transition duration-500 ${siap ? "opacity-100" : "opacity-0"}`}
            />
          </>
        ) : (
          <video
            ref={ref}
            src={url}
            muted
            playsInline
            loop
            preload="metadata"
            onCanPlay={(e) => cobaPutar(e.currentTarget)}
            onPlaying={() => setSiap(true)}
            className="lk-foto h-auto w-full"
          />
        )}
      </span>
    </button>
  );
}

/* Ikon menu lembar — garis 1.8 ala rujukan. */
function IkonBagikan({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8"
         strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6" />
    </svg>
  );
}

function IkonUnduh({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8"
         strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 4v11" />
      <path d="m7 11 5 5 5-5" />
      <path d="M4 20h16" />
    </svg>
  );
}

/* Lembar bawah seluler ala Pinterest: thumbnail + judul + deskripsi +
   aksi (buka laporan, bagikan, unduh). Hanya dipakai di aliran. */
function LembarLaporan({ berita: b, bahasa, onTutup, onBuka }: {
  berita: Berita; bahasa: Bahasa; onTutup: () => void; onBuka: () => void;
}) {
  const t = TEKS[bahasa];
  const [tersalin, setTersalin] = useState(false);
  const gambar = b.gambar ?? b.media.find((m) => m.jenis === "gambar")?.url ?? null;

  useEffect(() => {
    const saatTombol = (e: KeyboardEvent) => {
      if (e.key === "Escape") onTutup();
    };
    window.addEventListener("keydown", saatTombol);
    const limpahan = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", saatTombol);
      document.body.style.overflow = limpahan;
    };
  }, [onTutup]);

  async function bagikan() {
    const tautan = `${window.location.origin}/${bahasa}/fire/${b.slug ?? b.id}`;
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: b.judul, url: tautan });
        return;
      } catch (e: unknown) {
        if (e instanceof Error && e.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(tautan);
      setTersalin(true);
      window.setTimeout(() => setTersalin(false), 2000);
    } catch {
      /* izin clipboard diblokir */
    }
  }

  return (
    <div className="lk-lembar-latar" onClick={onTutup}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={b.judul}
        onClick={(e) => e.stopPropagation()}
        className={`lk-lembar${gambar ? " lk-lembar-bergambar" : ""}`}
      >
        <button
          type="button"
          onClick={onTutup}
          aria-label={t.lembarTutup}
          className="lk-lembar-tutup"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2"
               strokeLinecap="round" className="size-7">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
        {gambar && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={gambar} alt="" aria-hidden="true" className="lk-lembar-gambar" />
        )}
        <p className="lk-lembar-info">
          {b.tanggal}{b.lokasi ? ` • ${b.lokasi}` : ""}
        </p>
        <h2 className="lk-lembar-judul">{b.judul}</h2>
        {b.deskripsi && <p className="lk-lembar-deskripsi">{b.deskripsi}</p>}
        <button type="button" onClick={onBuka} className="lk-lembar-besar">
          {t.lembarBuka}
        </button>
        <ul className="lk-lembar-menu">
          <li>
            <button type="button" onClick={bagikan} className="lk-lembar-baris">
              <IkonBagikan />
              <span>{tersalin ? t.lembarTersalin : t.lembarBagikan}</span>
            </button>
          </li>
          {gambar && (
            <li>
              <a href={gambar} download className="lk-lembar-baris">
                <IkonUnduh />
                <span>{t.lembarUnduh}</span>
              </a>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

function UmpanMasonry({ daftar, kolom, kartu }: {
  daftar: Laporan[];
  kolom: number;
  kartu: (l: Laporan, i: number) => React.ReactNode;
}) {
  const keranjang = useMemo(() => {
    const isi: Laporan[][] = Array.from({ length: Math.max(1, kolom) }, () => []);
    daftar.forEach((l, i) => {
      isi[i % isi.length].push(l);
    });
    return isi;
  }, [daftar, kolom]);

  return (
    <div className="lk-masonry mt-5 flex items-start">
      {keranjang.map((isiKolom, i) => (
        <div key={i} className="lk-masonry-kolom flex min-w-0 flex-1 flex-col">
          {isiKolom.map((l, j) => kartu(l, i * 100 + j))}
        </div>
      ))}
    </div>
  );
}

/* Ikon bilah tab seluler — garis 2, gaya X. */
function IkonBeranda({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9"
         strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m4 11 8-7 8 7" />
      <path d="M6 9.5V20h12V9.5" />
      <path d="M10 20v-5h4v5" />
    </svg>
  );
}

function IkonPlus({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9"
         strokeLinecap="round" className={className}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function IkonTulis({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9"
         strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

/* Ikon penyeberang section: panel (peta terlipat) dan umpan (tumpukan foto).
   Panel memakai peta, bukan kisi instrumen seperti dulu — isi halaman yang
   dituju memang peta sebaran, dan kisi abstrak tak memberi petunjuk apa pun
   soal itu. Bukan pin lokasi: berkas ini sudah punya IkonPin dan IkonLokasi,
   dan pin terbaca "tempat ini", bukan "peta". */
function IkonPanel({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9"
         strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 6.2 9 4 15 6.2 21 4 21 17.8 15 20 9 17.8 3 20 Z" />
      <path d="M9 4V17.8" />
      <path d="M15 6.2V20" />
    </svg>
  );
}

function IkonUmpan({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9"
         strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="4" y="4" width="7" height="10" rx="1.5" />
      <rect x="13" y="4" width="7" height="6" rx="1.5" />
      <rect x="13" y="12" width="7" height="8" rx="1.5" />
      <rect x="4" y="16" width="7" height="4" rx="1.5" />
    </svg>
  );
}

/* Komposer laporan inline ala X: tampilan menciut (avatar + ajakan + ikon +
   pil Kirim), mengembang jadi mini-form saat disentuh, dan mengirim lewat
   server action YANG SAMA dengan form /lapor — tanpa pindah halaman.

   Syarat server yang wajib dipenuhi di sini juga: judul, deskripsi, minimal
   satu berkas, dan token Turnstile (bila site key dipasang). Lokasi opsional;
   tanpa lat/lng server mencoba EXIF foto. Nama opsional + centang anonim
   seperti form /lapor. */
function KomposerLapor({ bahasa }: { bahasa: Bahasa }) {
  const t = TEKS[bahasa];
  const router = useRouter();
  const [buka, setBuka] = useState(false);
  const [judul, setJudul] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [berkas, setBerkas] = useState<File[]>([]);
  const [pratinjau, setPratinjau] = useState<Record<string, string>>({});
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [lokasiAda, setLokasiAda] = useState(false);
  const [nama, setNama] = useState("");
  const [anonim, setAnonim] = useState(false);
  const [mencariLokasi, setMencariLokasi] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [galatKlien, setGalatKlien] = useState("");
  const [terkirim, setTerkirim] = useState(false);
  const [menungguToken, setMenungguToken] = useState(false);

  const berkasRef = useRef<HTMLInputElement | null>(null);
  const captchaRef = useRef<HTMLDivElement | null>(null);
  const widgetRef = useRef<number | null>(null);
  const sedangKirimRef = useRef(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const penungguToken = useRef<((tiba: boolean) => void)[]>([]);
  const urlRef = useRef<string[]>([]);
  const lokasiAktifRef = useRef(true);
  useEffect(() => {
    lokasiAktifRef.current = true;
    return () => {
      lokasiAktifRef.current = false;
      for (const url of urlRef.current) URL.revokeObjectURL(url);
      urlRef.current = [];
    };
  }, []);

  const ulangCaptcha = useCallback(() => {
    setCaptchaToken("");
    const ts = turnstile();
    if (ts && widgetRef.current !== null) {
      try {
        ts.reset(widgetRef.current);
      } catch {
        /* widget sudah lepas */
      }
    }
  }, []);

  const [keadaan, aksi, mengirim] = useActionState<KeadaanLapor, FormData>(
    async (sebelumnya: KeadaanLapor, data: FormData) => {
      try {
        const hasil = await kirimLaporan(sebelumnya, data);
        if (hasil?.ok) {
          for (const url of urlRef.current) URL.revokeObjectURL(url);
          urlRef.current = [];
          setPratinjau({});
          setBerkas([]);
          setJudul("");
          setDeskripsi("");
          setLat("");
          setLng("");
          setLokasiAda(false);
          setNama("");
          setAnonim(false);
          setTerkirim(true);
          router.refresh();
        } else {
          ulangCaptcha();
        }
        return hasil;
      } finally {
        sedangKirimRef.current = false;
      }
    },
    null,
  );

  const sinkronkanKeInput = useCallback((daftar: File[]) => {
    const input = berkasRef.current;
    if (!input) return;
    try {
      if (typeof DataTransfer !== "undefined") {
        const dt = new DataTransfer();
        for (const b of daftar) dt.items.add(b);
        input.files = dt.files;
      }
    } catch {
      /* peramban tanpa dukungan DataTransfer */
    }
  }, []);

  useEffect(() => {
    // `buka` ikut disinkronkan: input berkas di mode menciut dan di form adalah
    // dua elemen berbeda — berkas yang dipilih sebelum mengembang harus pindah
    // ke input form, kalau tidak kiriman berangkat tanpa lampiran.
    sinkronkanKeInput(berkas);
  }, [berkas, keadaan, buka, sinkronkanKeInput]);

  // Pesan sukses hanya mampir 5 detik: laporan masih antre kurasi sebelum
  // tampil di publik, lalu komposer kembali ke tampilan awal yang menciut.
  useEffect(() => {
    if (!terkirim) return;
    const jam = window.setTimeout(() => {
      setTerkirim(false);
      setBuka(false);
    }, 5000);
    return () => window.clearTimeout(jam);
  }, [terkirim]);

  // Widget Turnstile dipasang saat komposer mengembang — sama seperti form
  // /lapor: appearance interaction-only, tak terlihat kecuali ditantang.
  useEffect(() => {
    if (!buka || !SITE_KEY) return;
    let hidup = true;
    const pasang = () => {
      const wadah = captchaRef.current;
      const ts = turnstile();
      if (!wadah || !hidup) return;
      if (!ts) {
        window.setTimeout(pasang, 100);
        return;
      }
      try {
        ts.remove(widgetRef.current);
      } catch {
        /* belum ada widget */
      }
      wadah.innerHTML = "";
      widgetRef.current = ts.render(wadah, {
        sitekey: SITE_KEY,
        appearance: "interaction-only",
        callback: (token: string) => {
          setCaptchaToken(token);
          penungguToken.current.splice(0).forEach((bangun) => bangun(true));
        },
        "expired-callback": () => {
          setCaptchaToken("");
          if (widgetRef.current !== null) {
            try {
              ts.reset(widgetRef.current);
            } catch {
              /* widget sudah lepas */
            }
          }
        },
        "error-callback": () => {
          setCaptchaToken("");
          if (widgetRef.current !== null) {
            try {
              ts.reset(widgetRef.current);
            } catch {
              /* widget sudah lepas */
            }
          }
        },
      });
    };
    pasang();
    return () => {
      hidup = false;
      const ts = turnstile();
      if (ts && widgetRef.current !== null) {
        try {
          ts.remove(widgetRef.current);
        } catch {
          /* sudah lepas */
        }
        widgetRef.current = null;
      }
    };
  }, [buka]);

  function tambahBerkas(dipilih: FileList | null) {
    if (!dipilih || dipilih.length === 0) return;
    setBuka(true);
    setGalatKlien("");
    const sudah = new Set(berkas.map(kunciBerkas));
    const gabungan = [...berkas];
    const kunciBaru: string[] = [];
    for (const b of dipilih) {
      const kunci = kunciBerkas(b);
      if (!sudah.has(kunci)) {
        sudah.add(kunci);
        gabungan.push(b);
        kunciBaru.push(kunci);
      }
    }
    if (gabungan.length > BATAS_BERKAS) {
      setGalatKlien(t.terlaluBanyak);
      return;
    }
    if (gabungan.reduce((n, b) => n + b.size, 0) > BATAS_TOTAL_BYTE) {
      setGalatKlien(t.terlaluBesar);
      return;
    }
    const tambahanUrl: Record<string, string> = {};
    for (const kunci of kunciBaru) {
      const b = gabungan.find((x) => kunciBerkas(x) === kunci);
      if (b) {
        const url = URL.createObjectURL(b);
        urlRef.current.push(url);
        tambahanUrl[kunci] = url;
      }
    }
    if (Object.keys(tambahanUrl).length > 0) {
      setPratinjau((lama) => ({ ...lama, ...tambahanUrl }));
    }
    setBerkas(gabungan);
    sinkronkanKeInput(gabungan);
    if (berkasRef.current) berkasRef.current.value = "";
  }

  function hapusBerkas(kunci: string, url: string | undefined) {
    if (url) {
      URL.revokeObjectURL(url);
      urlRef.current = urlRef.current.filter((u) => u !== url);
    }
    setPratinjau((lama) => {
      const sisa = { ...lama };
      delete sisa[kunci];
      return sisa;
    });
    const sisaBerkas = berkas.filter((x) => kunciBerkas(x) !== kunci);
    setBerkas(sisaBerkas);
    sinkronkanKeInput(sisaBerkas);
  }

  function lokasiSaya() {
    setBuka(true);
    if (!navigator.geolocation) {
      setGalatKlien(t.lokasiGagal);
      return;
    }
    setMencariLokasi(true);
    setGalatKlien("");
    navigator.geolocation.getCurrentPosition(
      (posisi) => {
        if (!lokasiAktifRef.current) return;
        setMencariLokasi(false);
        setLat(posisi.coords.latitude.toFixed(7));
        setLng(posisi.coords.longitude.toFixed(7));
        setLokasiAda(true);
      },
      () => {
        if (!lokasiAktifRef.current) return;
        setMencariLokasi(false);
        setGalatKlien(t.lokasiGagal);
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  if (terkirim) {
    return (
      <div role="status" className="rounded-xl bg-black p-5 text-center ring-1 ring-white/5">
        <p className="text-[15px] font-bold text-[#f5f5f5]">{t.terkirim}</p>
        <p className="mx-auto mt-1 max-w-[46ch] text-[13px] leading-relaxed text-[#a0a0a0]">
          {t.terkirimIsi}
        </p>
        <button
          type="button"
          onClick={() => setTerkirim(false)}
          className="mt-3 rounded-full bg-[#e7e9ea] px-5 py-1.5 text-[14px] font-bold text-black transition
                     hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          {t.tulisLagi}
        </button>
      </div>
    );
  }

  const galat = galatKlien || (keadaan && !keadaan.ok ? keadaan.galat : "");
  const ikonAksi = "lk-ikon-aksi rounded-full p-2 text-[#ff5a26] transition hover:bg-[#ff5a26]/10 focus-visible:outline-2 focus-visible:outline-[#ff5a26]";

  return (
    <div className="rounded-xl bg-black p-4 ring-1 ring-white/5">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="lk-avatar flex size-11 shrink-0 items-center justify-center rounded-full bg-[#2f7d6d]">
          <IkonOrang className="size-6 text-white" />
        </span>
        {!buka ? (
          <button
            type="button"
            id="lk-tulis"
            onClick={() => setBuka(true)}
            className="flex-1 truncate py-2 text-left text-[17px] text-[#a0a0a0]/70 transition-colors hover:text-[#a0a0a0]
                       focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff5a26]"
          >
            {t.tulis}
          </button>
        ) : (
          <>
            <label htmlFor="lk-judul" className="sr-only">{t.judulPh}</label>
            {/* Di luar <form> tapi ikut terkirim lewat form="lk-form" — supaya
                ia bisa duduk sejajar avatar seperti komposer X. */}
            <input
              id="lk-judul"
              name="judul"
              form="lk-form"
              value={judul}
              onChange={(e) => setJudul(e.target.value)}
              placeholder={t.judulPh}
              maxLength={255}
              autoComplete="off"
              className="lk-tulis-isi min-w-0 flex-1 bg-transparent py-2 text-[15px] font-bold text-[#f5f5f5] placeholder:font-normal placeholder:text-[#a0a0a0]/70 focus:outline-none"
            />
          </>
        )}
      </div>

      {!buka ? (
        <div className="mt-2 flex items-center gap-1 panggung:pl-14">
          <button type="button" title={t.lampirFoto} aria-label={t.lampirFoto}
                  onClick={() => berkasRef.current?.click()} className={ikonAksi}>
            <IkonFoto />
          </button>
          <button type="button" title={t.lampirVideo} aria-label={t.lampirVideo}
                  onClick={() => berkasRef.current?.click()} className={ikonAksi}>
            <IkonVideo />
          </button>
          <button type="button" title={t.tandaiLokasi} aria-label={t.tandaiLokasi}
                  onClick={lokasiSaya} className={ikonAksi}>
            <IkonPin />
          </button>
          <button
            type="button"
            onClick={() => setBuka(true)}
            className="lk-kirim ml-auto rounded-full bg-[#e7e9ea] px-5 py-1.5 text-[15px] font-bold text-black transition
                       hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {t.kirim}
          </button>
        </div>
      ) : (
        <form
          ref={formRef}
          id="lk-form"
          action={aksi}
          onSubmit={(e) => {
            if (sedangKirimRef.current || mengirim || menungguToken) {
              e.preventDefault();
              return;
            }
            if (judul.trim() === "") {
              e.preventDefault();
              setGalatKlien(t.judulWajib);
              document.getElementById("lk-judul")?.focus();
              return;
            }
            if (deskripsi.trim() === "") {
              e.preventDefault();
              setGalatKlien(t.ceritaWajib);
              document.getElementById("lk-cerita")?.focus();
              return;
            }
            if (berkas.length === 0) {
              e.preventDefault();
              setGalatKlien(t.berkasWajib);
              return;
            }
            if (Boolean(SITE_KEY) && !captchaToken) {
              e.preventDefault();
              setGalatKlien("");
              setMenungguToken(true);
              new Promise<boolean>((selesai) => {
                const jam = setTimeout(() => {
                  penungguToken.current = penungguToken.current.filter((f) => f !== bangun);
                  selesai(false);
                }, 20000);
                const bangun = (tiba: boolean) => { clearTimeout(jam); selesai(tiba); };
                penungguToken.current.push(bangun);
              }).then((tiba) => {
                setMenungguToken(false);
                if (!tiba) {
                  setGalatKlien(t.keamananGagal);
                  return;
                }
                sedangKirimRef.current = true;
                formRef.current?.requestSubmit();
              });
              return;
            }
            sedangKirimRef.current = true;
          }}
          /* Indentasi sejajar-avatar ala X hanya di panggung. Di ponsel pl-14
             (56px) ditambah p-4 panel membuat kiri tersisip 72px sementara
             kanan cuma 16px — asimetris, dan sisa lebarnya tinggal ~286px
             sehingga baris Lat/Lng/Nama/Anonim mentok ke tepi. */
          className="mt-1 panggung:pl-14"
        >
          <textarea
            id="lk-cerita"
            name="deskripsi"
            value={deskripsi}
            onChange={(e) => setDeskripsi(e.target.value)}
            placeholder={t.ceritaPh}
            maxLength={5000}
            rows={3}
            className="lk-tulis-isi w-full resize-y bg-transparent py-1 text-[15px] leading-relaxed text-[#f5f5f5] placeholder:text-[#a0a0a0]/70 focus:outline-none"
          />

          {galat && (
            <p role="alert" className="mt-2 text-[13px] leading-relaxed text-[#ff7a59]">
              {galat}
            </p>
          )}

          <div ref={captchaRef} />
          <input ref={berkasRef} type="file" name="berkas" multiple accept={DITERIMA}
                 onChange={(e) => tambahBerkas(e.target.files)} className="sr-only" tabIndex={-1} />
          <input type="hidden" name="captcha" value={captchaToken} />
          <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />

          {/* Lokasi + nama ala form /lapor, versi ringkas sebaris: pin mengisi
              dari GPS (boleh juga ketik manual), nama opsional + centang
              anonim. Nama memanjang mengisi sisa baris supaya tak ada rongga. */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button type="button" title={t.tandaiLokasi} aria-label={t.tandaiLokasi}
                    onClick={lokasiSaya} disabled={mencariLokasi}
                    className={`${ikonAksi} ${lokasiAda ? "bg-[#ff5a26]/15" : ""} disabled:opacity-50`}>
              <IkonPin />
            </button>
            <label className="sr-only" htmlFor="lk-lat">{t.latPh}</label>
            <input id="lk-lat" name="lat" inputMode="decimal" placeholder={t.latPh}
                   value={lat} onChange={(e) => { setLat(e.target.value); setLokasiAda(false); }}
                   className="lk-isian lk-koord w-[86px] rounded-md bg-white/5 px-2 py-1.5 text-[13px] text-[#f5f5f5] ring-1 ring-white/10 placeholder:text-[#a0a0a0]/60 focus:outline-none focus:ring-[#ff5a26]" />
            <label className="sr-only" htmlFor="lk-lng">{t.lngPh}</label>
            <input id="lk-lng" name="lng" inputMode="decimal" placeholder={t.lngPh}
                   value={lng} onChange={(e) => { setLng(e.target.value); setLokasiAda(false); }}
                   className="lk-isian lk-koord w-[86px] rounded-md bg-white/5 px-2 py-1.5 text-[13px] text-[#f5f5f5] ring-1 ring-white/10 placeholder:text-[#a0a0a0]/60 focus:outline-none focus:ring-[#ff5a26]" />
            <label className="sr-only" htmlFor="lk-nama">{t.namaPh}</label>
            <input id="lk-nama" name="nama" maxLength={100} disabled={anonim} autoComplete="name"
                   value={nama} onChange={(e) => setNama(e.target.value)} placeholder={t.namaPh}
                   className="lk-isian min-w-[120px] flex-1 rounded-md bg-white/5 px-2 py-1.5 text-[13px] text-[#f5f5f5] ring-1 ring-white/10 placeholder:text-[#a0a0a0]/60 focus:outline-none focus:ring-[#ff5a26] disabled:opacity-40" />
            <label className="lk-anonim flex items-center gap-1.5 text-[13px] whitespace-nowrap text-[#a0a0a0]">
              <input type="checkbox" name="anonim" value="1" checked={anonim}
                     onChange={(e) => setAnonim(e.target.checked)}
                     className="lk-centang size-4 accent-[#ff5a26]" />
              {t.anonim}
            </label>
            {(mencariLokasi || lokasiAda) && (
              <span className="w-full text-[12px] text-[#a0a0a0]">
                {mencariLokasi ? t.mencariLokasi : t.lokasiOk}
              </span>
            )}
          </div>

          {/* Pratinjau di bawah baris lokasi+nama: kotak mengikuti ukuran
              gambar (kecil, utuh) berderet rapat ala X (flex-wrap). */}
          {berkas.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-4">
              {berkas.map((b) => {
                const kunci = kunciBerkas(b);
                const url = pratinjau[kunci];
                return (
                  <li key={kunci} className="min-w-0">
                    <span className="relative inline-block min-w-0">
                      <button type="button"
                              onClick={() => hapusBerkas(kunci, url)}
                              aria-label={`${b.name}`}
                              className="absolute -top-2.5 -right-2.5 z-[3] grid size-7 cursor-pointer place-items-center rounded-full
                                         bg-[#1e1e1e] text-white ring-1 ring-white/20 transition-colors hover:bg-[#e60012]">
                        <svg viewBox="0 0 20 20" aria-hidden="true" fill="currentColor" className="size-3.5">
                          <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                        </svg>
                      </button>
                      {url && b.type.startsWith("video/") ? (
                        <video src={`${url}#t=0.5`} preload="metadata" muted playsInline
                               className="h-14 w-auto min-w-14 max-w-full rounded-2xl bg-black object-contain ring-1 ring-white/15" />
                      ) : url ? (
                        /* eslint-disable-next-line @next/next/no-img-element -- pratinjau blob lokal */
                        <img src={url} alt="" className="h-14 w-auto max-w-full rounded-2xl bg-black object-contain ring-1 ring-white/15" />
                      ) : (
                        <span className="flex h-14 items-center justify-center rounded-2xl bg-white/5 px-3 text-[11px] text-[#a0a0a0] ring-1 ring-white/15">
                          {b.type.startsWith("video/") ? "Video" : "Foto"}
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mt-2 flex items-center gap-1 border-t border-white/10 pt-2">
            <button type="button" title={t.lampirFoto} aria-label={t.lampirFoto}
                    onClick={() => berkasRef.current?.click()} className={ikonAksi}>
              <IkonFoto />
            </button>
            <button type="button" title={t.lampirVideo} aria-label={t.lampirVideo}
                    onClick={() => berkasRef.current?.click()} className={ikonAksi}>
              <IkonVideo />
            </button>
            <button type="button" onClick={() => setBuka(false)}
                    className="lk-batal ml-auto px-3 py-1.5 text-[14px] text-[#a0a0a0] transition hover:text-white
                               focus-visible:outline-2 focus-visible:outline-[#ff5a26]">
              {t.batal}
            </button>
            <button
              type="submit"
              disabled={mengirim || menungguToken}
              aria-busy={mengirim || menungguToken}
              className="lk-kirim rounded-full bg-[#e7e9ea] px-5 py-1.5 text-[15px] font-bold text-black transition
                         hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white
                         disabled:opacity-60"
            >
              {mengirim ? t.mengirim : menungguToken ? t.memverifikasi : t.kirim}
            </button>
          </div>
        </form>
      )}

      {/* Input berkas untuk mode menciut — tambahBerkas() membuka komposernya. */}
      {!buka && (
        <input ref={berkasRef} type="file" name="berkas" multiple accept={DITERIMA}
               onChange={(e) => tambahBerkas(e.target.files)} className="sr-only" tabIndex={-1} />
      )}
    </div>
  );
}

/** Tab gagang pelipat rel kiri — padanan TabRel di halaman index, ditulis
 *  lokal karena di sana ia fungsi internal yang tidak diekspor. Satu bedanya:
 *  index mewarnainya menurut lapisan peta aktif (ungu asap / hijau windy),
 *  halaman ini tak punya pengalih lapisan jadi ia memakai aksen halamannya
 *  sendiri. Keyframe apungnya dipakai bersama — sudah ada di app/globals.css.
 *
 *  Posisi `left` sengaja dua nilai panjang yang konkret, bukan calc berisi
 *  var: custom property tidak diinterpolasi, jadi tombolnya akan melompat
 *  sementara kolomnya beranimasi. */
function TabRelKiri({ terbuka, onUbah, label, lebarRel }: {
  terbuka: boolean;
  onUbah: () => void;
  label: string;
  lebarRel: string;
}) {
  return (
    <span
      style={{ left: terbuka ? `calc(0.5rem + ${lebarRel})` : "0.5rem" }}
      className={`absolute top-1/2 z-[41] hidden -translate-y-1/2
                  transition-[left,translate] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]
                  motion-reduce:transition-none panggung:block ${
        terbuka ? "-translate-x-1/2" : "translate-x-3"
      }`}
    >
      <button
        type="button"
        onClick={onUbah}
        aria-expanded={terbuka}
        aria-controls="lk-rel-kiri"
        aria-label={label}
        title={label}
        className="lk-tab-rel group flex size-9 items-center justify-center rounded-full bg-[#ff5a26] text-black
                   ring-1 ring-inset ring-white/25 shadow-[0_6px_20px_rgb(255_90_38/0.45)]
                   transition-[scale,box-shadow,background-color] duration-300 ease-out
                   hover:scale-110 hover:shadow-[0_10px_28px_rgb(255_90_38/0.6)] active:scale-90
                   focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white
                   motion-safe:animate-[tab-rel-apung_3.2s_ease-in-out_infinite] hover:[animation-play-state:paused]"
      >
        {/* Satu panah yang berputar 180°: arahnya menunjuk ke mana relnya akan
            bergerak, jadi pergantiannya terbaca sebagai gerak, bukan ganti
            bentuk. */}
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.5"
             strokeLinecap="round" strokeLinejoin="round"
             className={`size-4 transition-[rotate,translate] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]
                         motion-reduce:transition-none ${
               terbuka ? "rotate-0 group-hover:-translate-x-0.5" : "rotate-180 group-hover:translate-x-0.5"
             }`}>
          <path d="m14 6-6 6 6 6" />
        </svg>
      </button>
    </span>
  );
}

export function LandingKarhutla(
  { bahasa, jumlahLaporan, berita = [], tampil = "semua", sorotan }: {
    bahasa: Bahasa;
    /** Peta butuh angka provinsi — halaman umpan tak memakainya. */
    jumlahLaporan?: Record<string, number>;
    berita?: Berita[];
    /** "semua" = dasbor (desktop dua rel; seluler hanya daftar laporan);
        "panel" = halaman panel situasi saja (peta+cuaca+statistik). */
    tampil?: "semua" | "panel";
    /** Enam angka kartu statistik dari CMS (bawaan 5.000 bila kosong). */
    sorotan: Record<KunciSorotan, number>;
  },
) {
  const t = TEKS[bahasa];
  // Lokasi + suhu otomatis dari IP (tanpa izin geolokasi); sebelum tiba,
  // lokasi memakai teks statis dan suhu memakai garis jeda.
  const cuaca = useCuacaLokal(bahasa, t.lokasi);
  const [cari, setCari] = useState("");
  /* Kolom pencarian tinggal di bilah kepala dan baru turun saat ikonnya
     diklik. Menutupnya sekaligus mengosongkan kata kuncinya: begitu kolomnya
     tak terlihat, penyaring yang masih aktif berubah jadi keadaan tersembunyi
     — umpan tampak memendek tanpa sebab yang kelihatan di layar. */
  const [cariBuka, setCariBuka] = useState(false);
  const ubahCariBuka = useCallback((buka: boolean) => {
    setCariBuka(buka);
    if (!buka) setCari("");
  }, []);
  /* Datang dari tombol cari di halaman panel seluler: di sana umpannya tidak
     dirender, jadi tombolnya mengantar ke halaman ini dan penanda ?cari=1
     inilah yang membuka kolomnya begitu sampai.

     Penandanya langsung dihapus dari URL: ia perintah sekali pakai, bukan
     keadaan halaman — kalau dibiarkan ia ikut terbagikan saat ditautkan dan
     membuka kolom lagi setiap kali halaman dimuat ulang. Sengaja tanpa
     dependensi apa pun: umpanTerlihat baru lahir jauh di bawah sini, dan
     mencantumkannya berarti daftar dependensi ini dievaluasi sebelum variabel
     itu ada. */
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("cari") !== "1") return;
    // Async (bukan sinkron) supaya lolos react-hooks/set-state-in-effect.
    //
    // Penghapusan penandanya WAJIB ikut di dalam callback ini, bukan di luar.
    // Strict Mode menjalankan effect dua kali: kalau URL dibersihkan langsung
    // di badan effect, jalan pertama menghapus penandanya sementara cleanup
    // membatalkan timer-nya — tak ada yang terbuka — lalu jalan kedua membaca
    // URL yang sudah telanjur kosong dan menyerah. Dengan keduanya ditunda
    // bersama, jalan yang dibatalkan tidak meninggalkan jejak apa pun.
    const jam = window.setTimeout(() => {
      setCariBuka(true);
      const params = new URLSearchParams(window.location.search);
      params.delete("cari");
      const sisa = params.toString();
      window.history.replaceState(null, "", window.location.pathname + (sisa ? `?${sisa}` : ""));
    }, 0);
    return () => window.clearTimeout(jam);
  }, []);
  /* Rel kiri (peta WebGL) hanya dirender bila terlihat: di halaman utama
     seluler ia dilepas supaya ponsel tak membayar MapLibre + tile + Zarr
     untuk peta yang tak tampil. Kelas lk-hanya-panggung tetap dipasang
     sebagai jaring pengaman (tanpa JS, CSS yang menyembunyikan). */
  const aliran = useAliran();
  /* Halaman /panel hanya untuk seluler: pengunjung desktop yang membuka
     langsung dikembalikan ke dasbor utuh. Dibaca live dari matchMedia (bukan
     state aliran): saat efek ini jalan pertama kali, state masih memegang
     snapshot server (panggung) sehingga membaca state salah mengusir
     pengunjung seluler ke dasbor.

     Tujuannya /<bahasa>, BUKAN /<bahasa>/karhutla. Keduanya merender dasbor
     yang sama sejak akar bahasa dijadikan halaman karhutla, tapi di mode
     etalase /<bahasa>/karhutla ditutup dan dialihkan 308 ke /<bahasa> — jadi
     mengarah ke sana membuat pengunjung desktop memantul DUA kali sebelum
     mendarat. Menuju akar bahasa langsung memangkas satu lompatan itu, dan
     berlaku benar di kedua mode.

     Catatan supaya tak salah duga di kemudian hari: sesudah pindah, DOM masih
     memuat subtree rute lama (terukur: dua .lk-bingkai, dua <main>) dan salah
     satunya membawa kelas mode panel. Itu bawaan navigasi lunak App Router,
     BUKAN akibat rantai pengalihan di atas — gejalanya sama persis di lokal
     yang tidak memakai mode etalase. Subtree itu display:none dan berukuran
     nol, jadi tak terlihat pengunjung. */
  const router = useRouter();
  useEffect(() => {
    if (tampil !== "panel") return;
    const panggung = window.matchMedia("(min-width: 1100px) and (min-height: 640px)").matches;
    if (panggung) {
      router.replace(`/${bahasa}`);
    }
  }, [tampil, bahasa, router]);
  /* Rel kiri bisa dilipat seperti di index. Lebarnya satu sumber: dipakai
     trek grid sekaligus posisi tombolnya. */
  const LEBAR_REL_KIRI = "clamp(340px,33.5vw,680px)";
  const [kiriBuka, setKiriBuka] = useState(true);
  /* Lembar panel seluler: terkatup atau mengintip. Hanya dipakai di halaman
     panel; di panggung kelasnya tak punya gaya apa pun. */
  const [lembarTutup, setLembarTutup] = useState(false);
  const panelTerlihat = tampil === "panel" || !aliran;
  const umpanTerlihat = tampil === "semua" || !aliran;

  // Pop-up rincian seperti index: tetap di halaman ini, URL ikut ke
  // /fire/<slug> supaya bisa dibagikan, kembali saat ditutup.
  const [sorot, setSorot] = useState<Berita | null>(null);
  // Lembar bawah seluler ("..."): pratinjau deskripsi per kartu.
  const [lembarId, setLembarId] = useState<number | null>(null);
  const bukaRincian = useCallback(
    (b: Berita) => {
      setSorot(b);
      if (typeof window !== "undefined") {
        const pathTujuan = b.slug ? `/${bahasa}/fire/${b.slug}` : window.location.pathname;
        if (window.location.pathname !== pathTujuan) {
          window.history.replaceState({ lkRincian: b.slug ?? true }, "", pathTujuan);
        }
      }
    },
    [bahasa],
  );
  const tutupRincian = useCallback(() => {
    setSorot(null);
    if (typeof window !== "undefined") {
      const pathAwal = `/${bahasa}/karhutla${tampil === "panel" ? "/panel" : ""}`;
      if (window.location.pathname !== pathAwal) {
        window.history.replaceState(null, "", pathAwal);
      }
    }
  }, [bahasa, tampil]);
  useEffect(() => {
    const saatPopState = () => {
      if (window.location.pathname.endsWith("/karhutla") || window.location.pathname.endsWith("/karhutla/panel")) {
        setSorot(null);
      }
    };
    window.addEventListener("popstate", saatPopState);
    return () => window.removeEventListener("popstate", saatPopState);
  }, []);
  const bukaDariId = useCallback(
    (id: number) => {
      const asli = berita.find((b) => b.id === id);
      if (asli) bukaRincian(asli);
    },
    [berita, bukaRincian],
  );
  const lembar = lembarId !== null ? (berita.find((b) => b.id === lembarId) ?? null) : null;
  /* Overlay peta selayar — dibuka lewat tombol bentang di sudut bingkai.
     Di-render sebagai instance <Peta> kedua di portal body (Opsi A): sederhana
     dan ikut pola komposer-lapor/popup-peta. Datanya sama (jumlahLaporan),
     kameranya mulai dari Nusantara seperti bingkai kecil. */
  const [petaPenuh, setPetaPenuh] = useState(false);
  const tombolBentangRef = useRef<HTMLButtonElement>(null);

  /* Escape menutup overlay — pola yang sama dengan pop-up lain di konsol.
     Badan dikunci supaya roda/sentuh di belakang overlay tak ikut menggulir
     halaman; fokus dikembalikan ke tombol pemicu saat overlay ditutup. */
  useEffect(() => {
    if (!petaPenuh) return;
    const tekan = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPetaPenuh(false);
    };
    window.addEventListener("keydown", tekan);
    const limpahan = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    /* Salin ref ke variabel: nilai .current bisa berubah saat cleanup jalan. */
    const pemicu = tombolBentangRef.current;
    return () => {
      window.removeEventListener("keydown", tekan);
      document.body.style.overflow = limpahan;
      pemicu?.focus();
    };
  }, [petaPenuh]);

  /* Skala bingkai peta. Dua hal dipisah di sini: BESAR pengecilnya dihitung
     dari lebar rel yang diukur (lihat di bawah), sedangkan PILIHAN modenya
     mengikuti breakpoint panggung/aliran halaman ini. */
  const bingkaiPetaRef = useRef<HTMLDivElement>(null);
 
 
  const isiPetaRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const bingkai = bingkaiPetaRef.current;
    const isi = isiPetaRef.current;
    if (!bingkai || !isi) return;
    /* Lebar LOGIS dibuat adaptif, bukan tetap. Tujuannya menjaga ukuran tampak
       perkakas konstan di ~0,35 ukuran asli — angka yang dipakai rujukan desain
       — berapa pun lebar relnya.

       Rumusnya turun dari peta-asap.tsx: hamparannya mengecil sendiri sebesar
       max(0,6; L/1760), dan legenda baru terbuka bila L >= AMBANG_SEMPIT (800).
       Selama L <= 1056 pengecilnya mentok di lantai 0,6, jadi ukuran tampak
       perkakas = 0,6 x (w / L). Menyetel itu ke 0,35 memberi L = 1,714 w.

       Versi sebelumnya memakai L tetap 1080px dengan ambang lebar 560px, dan
       pengukuran membuktikannya salah: HANYA layar 1920 yang lolos (bingkai
       603px) — 1728 sudah 539px, dan di zoom 125% (viewport 1536) relnya 475px,
       sehingga peta balik ke ukuran asli. */
    const RASIO = 1080 / 544;
    const SASARAN = 0.35;
    const LANTAI_HAMPARAN = 0.6;
    const AMBANG_SEMPIT = 800;
    const LEBAR_LOGIS_MAKS = 1760;
    /* Yang memilih mode adalah breakpoint panggung/aliran halaman ini, BUKAN
       ambang piksel pada bingkai peta. Di aliran peta digambar seukuran
       aslinya, memakai pola bingkai sempit milik PetaAsap yang memang
       dirancang untuk layar sempit.

       Ambang piksel sudah dicoba dua kali (560px lalu 380px) dan keduanya
       meleset, karena jarak antara kedua kasus cuma 31px: bingkai ponsel 382px
       di layar 414, bingkai desktop tersempit 413px di layar 1280. Ambang 380
       lolos hanya berkat selisih 2px — ponsel 430px atau ponsel melintang akan
       jatuh ke sisi yang salah. Dan jatuh ke sisi yang salah itu mahal: pada
       mode terskala perkakas ponsel menyusut ke 0,286, membuat tombol putar
       dan penggeser bilah waktu tinggal ~10px — terlalu kecil untuk disentuh,
       bukan sekadar sulit dibaca.

       Kuerinya sama persis dengan varian `panggung` di app/globals.css. */
    const panggung = window.matchMedia("(min-width: 1100px) and (min-height: 640px)");
    /* Gaya ditulis langsung ke elemen, bukan lewat state: menyetel state dari
       dalam effect dilarang `react-hooks/set-state-in-effect`, dan ini murni
       perkara tampilan yang tak perlu memicu render ulang. */
    const skalakan = () => {
      const lebar = bingkai.clientWidth;
      if (!lebar) return;
      const gaya = isi.style;
      if (panggung.matches) {
        const logis = Math.min(
          LEBAR_LOGIS_MAKS,
          Math.max(AMBANG_SEMPIT, (LANTAI_HAMPARAN / SASARAN) * lebar),
        );
        gaya.inset = "auto";
        gaya.top = "0";
        gaya.left = "0";
        gaya.width = `${logis}px`;
        gaya.height = `${logis / RASIO}px`;
        gaya.transformOrigin = "top left";
        gaya.transform = `scale(${lebar / logis})`;
        /* min-h pembungkus hanya urusan mode ukuran asli. Dibiarkan menyala di
           sini ia menyisakan pita kosong di dasar kotak: pembungkus dipaksa
           280px sementara isi terskala cuma setinggi lebar/rasio. */
        bingkai.style.minHeight = "0px";
      } else {
        /* Kembali ke ukuran asli: gaya sebaris dilepas supaya aturan
           .lk-peta-isi (inset:0) dan min-h kelasnya yang berlaku lagi. min-h itu
           menjaga tinggi tetap di atas AMBANG_LIPAT (200px) milik peta-asap.tsx,
           yang di bawahnya buffer WebGL tak dialokasikan ulang. */
        gaya.inset = "";
        gaya.top = "";
        gaya.left = "";
        gaya.width = "";
        gaya.height = "";
        gaya.transformOrigin = "";
        gaya.transform = "";
        bingkai.style.minHeight = "";
      }
    };
    skalakan();
    const amati = new ResizeObserver(skalakan);
    amati.observe(bingkai);
    /* ResizeObserver saja buta terhadap perpindahan mode ini: melintasi ambang
       min-height 640px bisa terjadi tanpa lebar bingkai bergeser sedikit pun,
       padahal perlintasan itulah yang menentukan modenya. */
    panggung.addEventListener("change", skalakan);
    return () => {
      amati.disconnect();
      panggung.removeEventListener("change", skalakan);
    };
  }, []);
  /* Umpan langsung dari basis data — SELURUH kejadian tayang, terbaru dulu,
     sama seperti arsip di index. Satu kartu satu media utama: video pertama
     di galeri bila ada (kolom `video` lama ikut dihitung), kalau tidak foto
     pertama; tanpa media sama sekali kartunya memakai placeholder. */
  const laporan = useMemo<Laporan[]>(
    () =>
      berita.map((b) => {
        const vid = b.media.find((m) => m.jenis === "video");
        const gbr = b.media.find((m) => m.jenis === "gambar");
        return {
          id: b.id,
          gambar: vid
            ? (vid.poster ?? b.poster ?? b.gambar)
            : (gbr?.url ?? b.gambar ?? b.poster),
          video: vid?.url ?? b.video ?? undefined,
          alt: b.alt,
          judul: b.judul,
          tanggal: b.tanggal,
          href: b.slug ? `/${bahasa}/fire/${b.slug}` : `/${bahasa}`,
        };
      }),
    [berita, bahasa],
  );
  const kata = cari.trim().toLowerCase();
  const hasil = laporan.filter((l) => l.judul.toLowerCase().includes(kata));
  const kolom = gunakanKolomUmpan(kiriBuka);

  return (
    <div className={`lk-bingkai${tampil === "panel" ? " lk-mode-panel" : ""} min-h-dvh bg-[#0a0a0a] pt-16 text-[#f5f5f5] antialiased`}>
      {/* Bilah kepala SAMA dengan halaman index — <Nav gelap>: fixed h-16,
          logo Fire + merek + tombol Lapor + pemilih bahasa. pt-16 pada bingkai
          memberi ruang di bawah bilah yang fixed (pola halaman-peta.tsx). */}
      <Nav
        bahasa={bahasa}
        gelap
        cari={
          umpanTerlihat
            ? {
                nilai: cari,
                ubah: setCari,
                terbuka: cariBuka,
                setTerbuka: ubahCariBuka,
                placeholder: t.cariLaporan,
              }
            : {
                /* Panel seluler: umpannya tidak dirender di halaman ini, jadi
                   kolom pencarian di sini hanya akan menyaring nol kartu.
                   Tombolnya tetap ada supaya bilahnya sama di kedua halaman,
                   tapi ia MENGANTAR ke daftar laporan — laporannya memang
                   tinggal di sana. Karena itu `terbuka` selalu false: tak
                   pernah ada kolom yang dibuka di halaman ini.

                   Penanda ?cari=1 yang dibawa itulah yang membuka kolomnya
                   begitu sampai — pembacanya ada di effect dekat deklarasi
                   cariBuka, dan penandanya langsung dihapus dari URL di sana
                   supaya tidak ikut terbagikan. */
                nilai: "",
                ubah: () => undefined,
                terbuka: false,
                setTerbuka: (buka: boolean) => {
                  if (buka) router.push(`/${bahasa}/karhutla?cari=1`);
                },
                placeholder: t.cariLaporan,
              }
        }
      />
      {/* H1 ikut bahasa halaman — pola yang sama dengan index. */}
      <h1 className="sr-only">{t.judul}</h1>

      {/* Dua rel sejajar yang mengisi lebar layar. Rujukannya memang tanpa pias
          tengah — instrumen di kiri, umpan di kanan, keduanya sampai tepi.
          Desktop selalu utuh dua rel seperti awal; yang dipisah per halaman
          hanya seluler (halaman utama = daftar, /panel = panel). */}
      {/* Kedua trek dinyatakan minmax(0,<panjang>) — TANPA fr. grid-template-columns
          hanya bisa dianimasikan kalau daftar treknya cocok tipe, dan satu trek
          yang tak cocok mematikan interpolasi seluruh daftar; lajur sisa karena
          ditulis eksplisit sebagai 100% dikurangi rel dan selanya. Catatan
          yang sama ada di halaman-peta.tsx. */}
      <div
        style={{ "--lk-kiri": kiriBuka ? LEBAR_REL_KIRI : "0px" } as React.CSSProperties}
        className={`lk-isi relative grid w-full gap-2 p-2 aliran:grid-cols-1${tampil === "panel" ? " lk-penuh-mobile" : ""}
                   panggung:grid-cols-[minmax(0,var(--lk-kiri))_minmax(0,calc(100%-var(--lk-kiri)-0.5rem))]
                   panggung:transition-[grid-template-columns] panggung:duration-500
                   panggung:ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none`}
      >
        {panelTerlihat && tampil === "semua" && (
          <TabRelKiri
            terbuka={kiriBuka}
            onUbah={() => setKiriBuka((b) => !b)}
            lebarRel={LEBAR_REL_KIRI}
            label={kiriBuka
              ? (bahasa === "en" ? "Collapse situation panel" : "Tutup panel situasi")
              : (bahasa === "en" ? "Open situation panel" : "Buka panel situasi")}
          />
        )}
        {/* ── Rel kiri: instrumen ──
            Tanpa panel sendiri: isinya berdiri langsung di atas latar halaman,
            dan kartu-kartu hitam di dalamnyalah yang memberi bentuk. */}
        {panelTerlihat && (
        <aside id="lk-rel-kiri" aria-label={t.situasi} className={`lk-kiri min-h-0 min-w-0 px-2 pt-1${tampil === "semua" ? " lk-hanya-panggung" : ""}`}>
          <div aria-hidden="true" className="lk-titik h-9" />

          {/* Peta yang sama persis dengan halaman index — komponen <Peta>,
              bukan tiruan statis. Impornya dinamis (ssr:false) di dalam
              peta.tsx, jadi MapLibre tidak ikut render server maupun bundel
              awal halaman ini.

              Di panggung peta digambar pada ukuran desain konsol lalu
              DIKECILKAN, bukan digambar langsung sebesar rel. Sebabnya ada di
              peta-asap.tsx: hamparannya menskalakan diri dari lebar bingkai,
              `lebar < 640 ? 1 : lebar / 1760`, dan AMBANG_SEMPIT=800 menentukan
              legenda terbuka atau menciut jadi cip. Rel kita 615px — jatuh ke
              kedua cabang sempit itu, jadi perkakasnya tergambar seukuran penuh
              dan legendanya menciut. Dengan lebar logis 1080px, PetaAsap
              melihat bingkai lega: skala hamparan 0,61 dan legenda terbuka,
              persis rujukan desain.

              Pengecilnya `transform`, BUKAN `zoom`: ResizeObserver membaca
              ukuran tata letak, dan `zoom` ikut mengubah ukuran itu sehingga
              justru membatalkan tujuannya. `transform` tidak menyentuhnya.
              Hasil akhirnya 0,61 x (615/1080) = 0,35 dari ukuran asli — sama
              dengan rujukan, yang 0,69 x (616/1220) = 0,35.

              Hanya di panggung. Di ponsel faktornya jadi 382/1080 = 0,35,
              sehingga perkakas tinggal 0,22 ukuran asli dan teksnya 2-3px;
              cabang `< 640` milik PetaAsap itu memang "pola ponsel tanpa
              skala", jadi di sana rendering apa adanya yang benar.

              min-h-[280px] hanya mengikat di aliran: rasio 1080/544 memberi
              tinggi ~192px di layar 414px, di bawah AMBANG_LIPAT (200px) yang
              membuat PetaAsap berhenti mengalokasikan buffer WebGL-nya. Di
              panggung rasio itu sudah memberi 308px, jadi ia menganggur.

              zoomRoda SENGAJA tidak dipasang, berbeda dari konsol: halaman ini
              menggulir, jadi roda tetikus yang dibajak peta akan mengunci
              guliran halaman begitu kursor melintasi bingkai. */}
          <div
            ref={bingkaiPetaRef}
            className="lk-bingkai-peta relative isolate aspect-[1080/544] min-h-[280px] w-full overflow-hidden rounded-md ring-1 ring-white/10"
          >
            <div ref={isiPetaRef} className="lk-peta-isi">
              <Peta
                jumlahLaporan={jumlahLaporan ?? {}}
                /* Halaman muka tidak punya pop-up provinsi seperti konsol —
                   petanya di sini untuk dilihat, bukan untuk ditelusuri. */
                onPilihWilayah={() => undefined}
                legendaRingkas
                tombolRapat
                muatNusantara
              />
            </div>
            {/* Tombol bentang — DI LUAR isiPetaRef supaya tak ikut
                transform: scale panggung. Ikon 4-sudut khas konsol /peta. */}
            <button
              ref={tombolBentangRef}
              type="button"
              onClick={() => setPetaPenuh(true)}
              aria-expanded={petaPenuh}
              aria-controls="lk-peta-selayar"
              title={t.bukaPetaSelayar}
              aria-label={t.bukaPetaSelayar}
              /* right-9, bukan right-2: PetaAsap menaruh tumpukan kendalinya
                 sendiri (zoom, rumah, muat ulang) di sudut yang sama, dan
                 tombol ini menimbuninya. Tepi kiri tumpukan itu terukur 26px
                 dari tepi bingkai di 1920 MAUPUN 1536 — ia ikut terskala
                 bersama peta — jadi satu offset tetap sudah aman di semua
                 lebar, tanpa perlu rumus proporsional. 36px menyisakan celah
                 10px, dan mendarat di zona atas-tengah yang kosong. */
              className="lk-tombol-peta absolute top-2 right-9 z-[43] flex size-9 items-center justify-center rounded-full
                         bg-black/70 text-white ring-1 ring-white/15 backdrop-blur-sm
                         transition hover:scale-105 hover:ring-[#ff5a26]/70 active:scale-95
                         motion-reduce:transition-none motion-reduce:hover:scale-100
                         focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none"
            >
              <IkonBentang className="size-4" />
            </button>
          </div>
          {/* Overlay selayar — instance <Peta> kedua TANPA wrapper skala:
              langsung inset-0 ukuran penuh, zoom roda dinyalakan karena
              badan halaman dikunci (tak ada guliran yang bisa terbajak).
              Portal ke body: bingkai memakai `isolate`, fixed di dalamnya
              tertahan (pola komposer-lapor/popup-peta). */}
          {petaPenuh
            ? createPortal(
                <div
                  id="lk-peta-selayar"
                  role="dialog"
                  aria-modal="true"
                  aria-label={t.bukaPetaSelayar}
                  className="lk-peta-penuh fixed inset-0 z-[70] bg-[#0a0a0a]"
                >
                  <div className="absolute inset-0">
                    <Peta
                      jumlahLaporan={jumlahLaporan ?? {}}
                      onPilihWilayah={() => undefined}
                      tombolRapat
                      muatNusantara
                      zoomRoda
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setPetaPenuh(false)}
                    title={t.tutupPetaSelayar}
                    aria-label={t.tutupPetaSelayar}
                    className="pointer-events-auto absolute top-4 right-4 z-[1100] flex size-9 items-center justify-center rounded-full
                               bg-black/70 text-white ring-1 ring-white/15 backdrop-blur-sm
                               transition hover:scale-105 hover:ring-[#ff5a26]/70 active:scale-95
                               motion-reduce:transition-none motion-reduce:hover:scale-100
                               focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none"
                  >
                    <IkonTutup className="size-4" />
                  </button>
                </div>,
                document.body,
              )
            : null}

          {/* Pembungkus lembar bawah. Di panggung ia sekadar div tanpa gaya —
              isinya mengalir seperti biasa; di halaman panel seluler CSS
              mengangkatnya jadi lembar yang mengintip di atas peta selayar. */}
          <div className={`lk-lembar-panel${lembarTutup ? " lk-panel-katup" : ""}`}>
            <button
              type="button"
              className="lk-lembar-gagang"
              onClick={() => setLembarTutup((v) => !v)}
              aria-expanded={!lembarTutup}
              aria-label={lembarTutup
                ? (bahasa === "en" ? "Open situation panel" : "Buka panel situasi")
                : (bahasa === "en" ? "Collapse situation panel" : "Tutup panel situasi")}
            >
              <span aria-hidden="true" />
            </button>

          {/* Sumur lokasi + cuaca: panel abu di atas latar hitam, pil lokasi
              yang lebih gelap di dalamnya — sesuai rujukan. mx-4: blok ini
              sengaja lebih sempit dan menengah dibanding peta di atasnya. */}
          <div className="mx-4 mt-3 rounded-2xl bg-[#1e1e1e] p-5">
            <p className="lk-lokasi flex items-center gap-3 rounded-xl bg-black/50 px-5 py-4 text-[13px] sm:text-[15px]">
              <IkonCari className="size-[18px] shrink-0 text-[#a0a0a0]" />
              <span className="truncate" aria-live="polite" title={cuaca.lokasi}>
                {cuaca.lokasi}
                <span className="text-[#a0a0a0]">/{t.lokasiOtomatis}</span>
              </span>
              <IkonLokasi className="ml-auto size-[22px] shrink-0 text-[#a0a0a0]" />
            </p>
            <p className="lk-angka mt-4 flex items-center gap-4 px-3 pb-1 text-[clamp(44px,3.8vw,68px)] leading-none font-semibold"
               aria-live="polite"
               aria-label={cuaca.suhu === null ? t.suhuMenunggu : `${cuaca.suhu} derajat celcius di ${cuaca.lokasi}`}>
              {cuaca.suhu === null ? "–" : `${cuaca.suhu}°`}
              <IkonCuaca kode={cuaca.kodeCuaca} siang={cuaca.siang} className="size-[clamp(34px,3vw,56px)] shrink-0 text-[#f5f5f5]" />
            </p>
            {/* Atribusi sumber cuaca — wajib tampil bila datanya BMKG (syarat
                portal data terbuka mereka), dan jujur bila jatuh ke model. */}
            {cuaca.sumber !== null && (
              <p className="lk-sumber px-3 text-[11px] text-[#a0a0a0]">
                {cuaca.sumber === "bmkg"
                  ? (bahasa === "en" ? "Source: BMKG" : "Sumber: BMKG")
                  : (bahasa === "en" ? "Source: weather model" : "Sumber: model cuaca")}
              </p>
            )}
          </div>

          {/* Enam angka situasi — mx-4: sejajar dengan panel cuaca, menengah
              terhadap peta. Kartu diberi min-w-0 + padding ramping supaya angka
              tidak meluap di rel sempit. */}
          <dl className="mx-4 mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {STATISTIK.map((s) => (
              <div key={s.kunci} className="flex min-w-0 flex-col rounded-2xl bg-[#1e1e1e] px-2 py-7 text-center">
                <dd className="lk-angka order-1 text-[clamp(24px,2.2vw,44px)] leading-none font-medium">
                  {sorotan[s.kunci].toLocaleString("id-ID", { maximumFractionDigits: 2 })}
                </dd>
                <dt className="order-2 mt-2 text-[12px] leading-tight font-bold text-balance sm:text-[13px]">
                  {s[bahasa]}
                </dt>
              </div>
            ))}
          </dl>

          <p className="lk-kaki mx-auto mt-4 max-w-[46ch] px-2 text-center text-[11px] leading-relaxed text-[#a0a0a0]">
            <strong className="font-bold text-[#f5f5f5]">{t.merek}</strong> — {t.kaki}
          </p>
          </div>
          <div aria-hidden="true" className="lk-titik lk-titik--bawah mt-3 h-9" />
        </aside>
        )}

        {/* ── Rel kanan: umpan laporan ──
            Halaman utama seluler: daftar gambar/video.

            Saat rel dilipat, isinya sengaja dibiarkan memakai lebar penuh —
            tanpa batas lebar dan tanpa pemusatan. */}
        {umpanTerlihat && (
        <main aria-label={t.umpan} className="lk-kanan pantau-rel min-h-0 min-w-0">
          <KomposerLapor bahasa={bahasa} />

          {hasil.length === 0 ? (
            <p className="mt-5 rounded-xl bg-black px-4 py-12 text-center text-[13px] text-[#a0a0a0]">
              {t.hasilKosong}
            </p>
          ) : (
            <UmpanMasonry
              daftar={hasil}
              kolom={kolom}
              kartu={(l) => (
                <article key={l.id} className="lk-kartu">
                  <div className="lk-kartu-teks">
                    <p className="lk-kartu-tanggal text-[13px] text-white/85 sm:text-[14px]">{l.tanggal}</p>
                    <div className="lk-kartu-judulbar">
                      <h2 className="mt-1.5 min-w-0 flex-1 text-[16px] leading-[1.25] font-bold tracking-tight sm:text-[19px]">
                        <button
                          type="button"
                          onClick={() => bukaDariId(l.id)}
                          className="text-left transition-colors hover:text-[#ff5a26] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff5a26]"
                        >
                          {l.judul}
                        </button>
                      </h2>
                      <button
                        type="button"
                        onClick={() => setLembarId(l.id)}
                        title={t.titikMenu}
                        aria-label={`${t.titikMenu}: ${l.judul}`}
                        aria-haspopup="dialog"
                        className="lk-kartu-titik shrink-0 rounded-full p-1.5 text-[#f5f5f5] transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-[#ff5a26]"
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" className="size-5">
                          <circle cx="5" cy="12" r="1.8" />
                          <circle cx="12" cy="12" r="1.8" />
                          <circle cx="19" cy="12" r="1.8" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  {/* Media apa adanya: video diputar di tempat dengan poster
                      bingkainya, gambar ditampilkan langsung. preload metadata
                      supaya mp4 tidak ikut terunduh sebelum dimainkan. Tanpa
                      media sama sekali: placeholder logo. */}
                  <div className="lk-kartu-media">
                  {l.video ? (
                    <VideoOtomatis
                      url={l.video}
                      poster={l.gambar}
                      label={l.judul}
                      onBuka={() => bukaDariId(l.id)}
                    />
                  ) : l.gambar ? (
                    <button
                      type="button"
                      onClick={() => bukaDariId(l.id)}
                      aria-label={l.judul}
                      className="block w-full transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff5a26] hover:brightness-95"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={l.gambar} alt={l.alt} loading="lazy" className="lk-foto mt-3" />
                    </button>
                  ) : (
                    <span className="lk-foto mt-3 flex aspect-[16/10] items-center justify-center" role="img" aria-label={l.alt}>
                      <Image src="/assets/img/logo-fire.png" alt="" aria-hidden="true" width={99} height={160} className="h-16 w-auto opacity-60" />
                    </span>
                  )}
                  </div>
                </article>
              )}
            />
          )}
        </main>
        )}
      </div>

      {/* Bilah tab seluler ala X — hanya tampil di aliran (CSS). Slot kedua
          adalah penyeberang halaman: di halaman utama (daftar) membuka panel,
          di halaman panel kembali ke daftar. */}
      <nav aria-label={t.umpan} className="lk-tabbar">
        <Link
          href={`/${bahasa}`}
          aria-label={t.tabBeranda}
          className="rounded-full p-2 text-[#f5f5f5] transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-[#ff5a26]"
        >
          <IkonBeranda />
        </Link>
        {tampil === "panel" ? (
          <Link
            href={`/${bahasa}/karhutla`}
            aria-label={t.tabUmpan}
            className="rounded-full p-2 text-[#f5f5f5] transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-[#ff5a26]"
          >
            <IkonUmpan />
          </Link>
        ) : (
          <Link
            href={`/${bahasa}/karhutla/panel`}
            aria-label={t.tabPanel}
            className="rounded-full p-2 text-[#f5f5f5] transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-[#ff5a26]"
          >
            <IkonPanel />
          </Link>
        )}
        {tampil === "semua" ? (
          <>
            <button
              type="button"
              aria-label={t.tabCari}
              onClick={() => ubahCariBuka(!cariBuka)}
              className="rounded-full p-2 text-[#f5f5f5] transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-[#ff5a26]"
            >
              <IkonCari className="size-7" />
            </button>
            <button
              type="button"
              aria-label={t.tabTulis}
              onClick={() => {
                (document.getElementById("lk-tulis") as HTMLButtonElement | null)?.click();
                window.setTimeout(() => document.getElementById("lk-judul")?.focus({ preventScroll: true }), 150);
              }}
              className="rounded-full p-2 text-[#f5f5f5] transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-[#ff5a26]"
            >
              <IkonPlus />
            </button>
          </>
        ) : (
          <>
            <Link
              href={`/${bahasa}/karhutla`}
              aria-label={t.tabTulis}
              className="rounded-full p-2 text-[#f5f5f5] transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-[#ff5a26]"
            >
              <IkonPlus />
            </Link>
            <Link
              href={`/${bahasa}/lapor`}
              aria-label={t.tabLapor}
              className="rounded-full p-2 text-[#f5f5f5] transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-[#ff5a26]"
            >
              <IkonTulis />
            </Link>
          </>
        )}
        <button
          type="button"
          aria-label={t.tabBeranda}
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="rounded-full p-2 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-[#ff5a26]"
        >
          <span aria-hidden="true" className="flex size-7 items-center justify-center rounded-full bg-[#2f7d6d]">
            <IkonOrang className="size-4 text-white" />
          </span>
        </button>
      </nav>
      <div aria-hidden="true" className="lk-tabbar-ruang" />

      {/* Rincian di halaman yang sama seperti index (URL ikut pindah agar
          bisa dibagikan, isi halaman tetap). */}
      {sorot && (
        <RincianLaporan berita={sorot} bahasa={bahasa} onTutup={tutupRincian} gelap />
      )}

      {/* Lembar deskripsi seluler dari tombol "...". */}
      {lembar && (
        <LembarLaporan
          berita={lembar}
          bahasa={bahasa}
          onTutup={() => setLembarId(null)}
          onBuka={() => {
            setLembarId(null);
            bukaRincian(lembar);
          }}
        />
      )}
    </div>
  );
}
