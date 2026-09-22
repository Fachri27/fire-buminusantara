"use client";

import { useActionState, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Peta } from "@/components/peta";
import { Nav } from "@/components/nav";
import { RincianLaporan } from "@/components/rincian-laporan";
import { PopupPeta } from "@/components/popup-peta";
import { UlasanKomentar, FormulirKomentar } from "@/components/kolom-komentar";
import { gunakanKomentar } from "@/hooks/gunakan-komentar";
import { gunakanKolomUmpan } from "@/hooks/gunakan-kolom-umpan";
import { BATAS_BERKAS, BATAS_TOTAL_BYTE } from "@/lib/batas-laporan";
import { ambilStatistik, type Statistik as DataStatistik } from "@/lib/statistik";
import type { KunciSorotan } from "@/lib/statistik-sorotan-teks";
import type { Bahasa } from "@/lib/bahasa";
import type { Berita } from "@/lib/events";
import { kirimLaporan, type KeadaanLapor } from "@/app/[locale]/lapor/aksi";

/** Site key Turnstile — sama seperti form /lapor. */
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

/** Panjang animasi keluar overlay peta selayar. Harus sama dengan
 *  @keyframes lk-peta-keluar di public/css/landing-karhutla.css. */
const DURASI_TUTUP_PETA = 200;

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

export type Laporan = {
  id: number;
  gambar: string | null; // foto — atau poster bingkai bila laporannya video
  video?: string; // mp4 bila laporannya video
  /** Seluruh media galeri (berurut) — >1 berarti ada lencana. */
  galeri: { url: string; jenis: "gambar" | "video"; poster?: string; keterangan?: string }[];
  alt: string;
  judul: string;
  tanggal: string;
  lokasi: string | null;
  deskripsi: string | null;
  slug: string | null;
  href: string;
};


const TEKS = {
  id: {
    // Judul penuh halaman — dipakai H1 sr-only; judul pendek + tombol lapor
    // kini milik <Nav gelap> yang dipakai bersama halaman index.
    judul: "Kebakaran Hutan dan Lahan",
    cariLaporan: "Lapor apa yang kamu lihat",
    lokasi: "Kalimantan Barat",
    lokasiOtomatis: "secara otomatis dibaca lokasi",
    lokasiTerdeteksi: "lokasi terdeteksi",
    lokasiDicari: "lokasi dicari",
    cariLokasiCuaca: "Cari kota/provinsi...",
    cariLokasiCuacaAria: "Cari lokasi cuaca",
    deteksiGpsCuacaAria: "Deteksi lokasi cuaca via GPS",
    batalCariCuaca: "Batal cari lokasi cuaca",
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
    videoBisu: "Nyalakan suara video",
    videoSenyap: "Bisukan video",
    videoUlang: "Putar ulang video",
    galeriSebelumnya: "Foto sebelumnya",
    galeriBerikutnya: "Foto berikutnya",
    postingan: "Postingan",
    kembali: "Kembali",
    suka: "Suka",
    komentar: "Komentar",
    selengkapnya: "selengkapnya",
    lebihSedikit: "lebih sedikit",
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
    lokasiTerdeteksi: "detected location",
    lokasiDicari: "searched location",
    cariLokasiCuaca: "Search city/province...",
    cariLokasiCuacaAria: "Search weather location",
    deteksiGpsCuacaAria: "Detect weather location via GPS",
    batalCariCuaca: "Cancel weather location search",
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
    videoBisu: "Unmute video",
    videoSenyap: "Mute video",
    videoUlang: "Replay video",
    galeriSebelumnya: "Previous photo",
    galeriBerikutnya: "Next photo",
    postingan: "Post",
    kembali: "Back",
    suka: "Like",
    komentar: "Comments",
    selengkapnya: "more",
    lebihSedikit: "less",
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
  const [memuat, setMemuat] = useState(false);
  const [sumberLokasi, setSumberLokasi] = useState<"otomatis" | "gps" | "cari">("otomatis");

  type Muatan = {
    nama?: unknown; suhu?: unknown; kodeCuaca?: unknown; siang?: unknown; sumber?: unknown;
  };
  const terapkan = useCallback((j: Muatan): void => {
    if (typeof j.nama === "string" && j.nama.trim() !== "") setLokasi(j.nama.trim());
    if (typeof j.suhu === "number" && Number.isFinite(j.suhu)) setSuhu(Math.round(j.suhu));
    if (typeof j.kodeCuaca === "number" && Number.isFinite(j.kodeCuaca)) setKodeCuaca(j.kodeCuaca);
    if (typeof j.siang === "boolean") setSiang(j.siang);
    if (j.sumber === "bmkg" || j.sumber === "model") setSumber(j.sumber);
  }, []);

  const cari = useCallback(async (kueri: string): Promise<boolean> => {
    const q = kueri.trim();
    if (!q) return false;
    setMemuat(true);
    try {
      const r = await fetch(`/api/cuaca-lokal?bahasa=${bahasa}&q=${encodeURIComponent(q)}`, {
        signal: AbortSignal.timeout(12000),
        headers: { Accept: "application/json" },
      });
      if (!r.ok) return false;
      const j = (await r.json()) as Muatan;
      terapkan(j);
      setSumberLokasi("cari");
      try {
        window.localStorage.setItem(
          `lk-cuaca-${bahasa}`,
          JSON.stringify({ t: Date.now(), data: j, sumberLokasi: "cari" })
        );
      } catch {
        /* penyimpanan penuh/diblokir */
      }
      return true;
    } catch {
      return false;
    } finally {
      setMemuat(false);
    }
  }, [bahasa, terapkan]);

  const deteksiGps = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      return;
    }
    setMemuat(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const r = await fetch(
            `/api/cuaca-lokal?bahasa=${bahasa}&lat=${latitude}&lng=${longitude}`,
            {
              signal: AbortSignal.timeout(12000),
              headers: { Accept: "application/json" },
            }
          );
          if (!r.ok) return;
          const j = (await r.json()) as Muatan;
          terapkan(j);
          setSumberLokasi("gps");
          try {
            window.localStorage.setItem(
              `lk-cuaca-${bahasa}`,
              JSON.stringify({ t: Date.now(), data: j, sumberLokasi: "gps" })
            );
          } catch {
            /* penyimpanan penuh/diblokir */
          }
        } catch {
          // gagal fetch cuaca dari gps
        } finally {
          setMemuat(false);
        }
      },
      () => {
        setMemuat(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  }, [bahasa, terapkan]);

  useEffect(() => {
    let hidup = true;
    // Cache lokal 15 menit: refresh langsung menampilkan angka terakhir
    // tanpa menunggu rantai server — lalu tetap divalidasi ulang di bawah.
    try {
      const mentah = window.localStorage.getItem(`lk-cuaca-${bahasa}`);
      if (mentah) {
        const { t, data, sumberLokasi: sl } = JSON.parse(mentah) as {
          t: number;
          data: Muatan;
          sumberLokasi?: "otomatis" | "gps" | "cari";
        };
        if (data && typeof t === "number" && Date.now() - t < 15 * 60_000) {
          setTimeout(() => {
            if (!hidup) return;
            terapkan(data);
            if (sl) setSumberLokasi(sl);
          }, 0);
        }
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
        const j = (await r.json()) as Muatan;
        if (!hidup) return true;
        terapkan(j);
        try {
          window.localStorage.setItem(
            `lk-cuaca-${bahasa}`,
            JSON.stringify({ t: Date.now(), data: j, sumberLokasi: "otomatis" })
          );
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
  }, [bahasa, terapkan]);

  const pilihSaran = useCallback(
    async (item: {
      nama: string;
      provinsi: string;
      lat: number;
      lng: number;
      adm4?: string;
    }): Promise<boolean> => {
      setMemuat(true);
      try {
        const param = new URLSearchParams({
          bahasa,
          lat: String(item.lat),
          lng: String(item.lng),
          nama: item.nama,
          provinsi: item.provinsi,
          ...(item.adm4 ? { adm4: item.adm4 } : {}),
        });
        const r = await fetch(`/api/cuaca-lokal?${param}`, {
          signal: AbortSignal.timeout(12000),
          headers: { Accept: "application/json" },
        });
        if (!r.ok) return false;
        const j = (await r.json()) as Muatan;
        terapkan(j);
        setSumberLokasi("cari");
        try {
          window.localStorage.setItem(
            `lk-cuaca-${bahasa}`,
            JSON.stringify({ t: Date.now(), data: j, sumberLokasi: "cari" })
          );
        } catch {
          /* penyimpanan penuh/diblokir */
        }
        return true;
      } catch {
        return false;
      } finally {
        setMemuat(false);
      }
    },
    [bahasa, terapkan]
  );

  return { lokasi, suhu, kodeCuaca, siang, sumber, memuat, sumberLokasi, cari, deteksiGps, pilihSaran };
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

/* Ikon suara video ala IG: speaker + gelombang (bersuara) / speaker + silang
   (bisu), dan panah melingkar untuk putar ulang. Garis 1.9 ala ikon tab. */
function IkonSuara({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9"
         strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M11 5 6.5 9H3v6h3.5L11 19V5Z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.2 6a9 9 0 0 1 0 12" />
    </svg>
  );
}

function IkonBisu({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9"
         strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M11 5 6.5 9H3v6h3.5L11 19V5Z" />
      <path d="m16 9.5 5 5M21 9.5l-5 5" />
    </svg>
  );
}

function IkonUlang({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9"
         strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4.5V10h5.5" />
    </svg>
  );
}

/* Video kartu umpan — autoplay bisu saat terlihat di layar
   (IntersectionObserver 25%), dijeda saat tidak; tanpa kontrol bawaan.

   Gaya Instagram: mulai bisu (syarat autoplay peramban), lencana bisu di kanan
   bawah untuk menyalakan/mematikan suara, dan setelah habis berhenti di bingkai
   terakhir dengan tombol putar ulang di tengah — bukan loop.
   Pengurang gerak berarti diam di poster. Poster di lapisan sendiri supaya
   kegagalan putar tak berarti kotak hitam. */
function VideoOtomatis({ url, poster, label, onBuka, tanpaMt = false, tanpaBuka = false, kredit = null, bahasa }: {
  url: string; poster: string | null; label: string; onBuka?: () => void;
  /** true di dalam carousel — margin atas milik wadah, bukan tombol. */
  tanpaMt?: boolean;
  /** true = media murni tampilan, tanpa tombol buka (dipakai halaman detail:
      videonya sudah berada di tempatnya, mengklik tak boleh membuka apa pun). */
  tanpaBuka?: boolean;
  /** Nama kredit untuk pil © — null = tanpa pil. */
  kredit?: string | null;
  bahasa: Bahasa;
}) {
  const t = TEKS[bahasa];
  const ref = useRef<HTMLVideoElement | null>(null);
  const terlihatRef = useRef(false);
  const [siap, setSiap] = useState(false);
  const [posterGagal, setPosterGagal] = useState(false);
  const [bisu, setBisu] = useState(true);
  const [usai, setUsai] = useState(false);

  // Sinkronkan PROPERTI muted setiap berubah — sebagian peramban hanya
  // mengizinkan autoplay bila propertinya true, bukan sekadar atributnya.
  useEffect(() => {
    const el = ref.current;
    if (el) el.muted = bisu;
  }, [bisu]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Properti muted, bukan sekadar atribut — syarat autoplay peramban.
    el.muted = true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const amati = new IntersectionObserver(
      (masuk) => {
        terlihatRef.current = masuk.some((m) => m.isIntersecting);
        // Yang sudah habis tidak ikut diputar lagi — menunggu tombol ulang.
        if (terlihatRef.current) {
          if (!el.ended) el.play().catch(() => {});
        } else el.pause();
      },
      { threshold: 0.25 },
    );
    amati.observe(el);
    return () => {
      amati.disconnect();
      el.pause();
    };
  }, [url]);

  const cobaPutar = useCallback((el: HTMLVideoElement) => {
    setSiap(true);
    if (terlihatRef.current && !el.ended) el.play().catch(() => {});
  }, []);

  function sakelarBisu(e: React.MouseEvent) {
    e.stopPropagation();
    const el = ref.current;
    if (!el) return;
    setBisu((v) => {
      const jadi = !v;
      el.muted = jadi;
      // Menyalakan suara sekaligus memastikan videonya berjalan — ia bisa
      // sedang dijeda di luar layar, atau sudah habis.
      if (!jadi) {
        if (el.ended) { setUsai(false); el.currentTime = 0; }
        el.play().catch(() => {});
      }
      return jadi;
    });
  }

  function putarUlang(e: React.MouseEvent) {
    e.stopPropagation();
    const el = ref.current;
    if (!el) return;
    setUsai(false);
    el.currentTime = 0;
    el.play().catch(() => {});
  }

  const isiMedia = poster && !posterGagal ? (
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
        muted={bisu}
        playsInline
        preload="metadata"
        aria-hidden="true"
        // SENGAJA tanpa tabIndex: video ini dekoratif di dalam tombol
        // bernama. Dengan tabIndex={-1} Chrome memindahkan fokus ke
        // sini saat diklik — lalu browser memblokir aria-hidden karena
        // fokus tak boleh disembunyikan dari teknologi asistif.
        onPlay={() => setUsai(false)}
        onEnded={() => setUsai(true)}
        onCanPlay={(e) => cobaPutar(e.currentTarget)}
        onPlaying={() => setSiap(true)}
        className={`lk-video absolute inset-0 h-full w-full object-cover transition duration-500 ${siap ? "opacity-100" : "opacity-0"}`}
      />
    </>
  ) : (
    <video
      ref={ref}
      src={url}
      muted={bisu}
      playsInline
      preload="metadata"
      aria-hidden="true"
      // Tanpa tabIndex seperti cabang berposter di atas: tabIndex={-1}
      // membuat klik memindahkan fokus ke video aria-hidden ini.
      onPlay={() => setUsai(false)}
      onEnded={() => setUsai(true)}
      onCanPlay={(e) => cobaPutar(e.currentTarget)}
      onPlaying={() => setSiap(true)}
      className="lk-foto h-auto w-full"
    />
  );

  return (
    // Wadah div (bukan button): tombol bisu/ulang bersarang di dalamnya dan
    // button-di-dalam-button tidak valid. Tombol buka-rincian melingkupi
    // medianya kecuali tanpaBuka; tombol bisu/ulang menghentikan rambatan
    // supaya tidak ikut membuka rincian.
    <div
      className={`lk-foto block w-full${tanpaMt ? "" : " mt-3"}`}
    >
      <span className="relative block">
        {tanpaBuka || !onBuka ? (
          <span className="block w-full">
            {isiMedia}
          </span>
        ) : (
          <button
            type="button"
            onClick={onBuka}
            aria-label={label}
            className="block w-full cursor-pointer transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff5a26] hover:brightness-95"
          >
            {isiMedia}
          </button>
        )}
        {usai ? (
          <span className="lk-video-ulang-wadah">
            <button
              type="button"
              onClick={putarUlang}
              aria-label={t.videoUlang}
              title={t.videoUlang}
              className="lk-video-ulang cursor-pointer"
            >
              <IkonUlang />
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={sakelarBisu}
            aria-label={bisu ? t.videoBisu : t.videoSenyap}
            title={bisu ? t.videoBisu : t.videoSenyap}
            aria-pressed={!bisu}
            className="lk-video-bisu cursor-pointer"
          >
            {bisu ? <IkonBisu /> : <IkonSuara />}
          </button>
        )}
        {kredit !== null && (
          <span aria-hidden="true" className="lk-kredit">
            ©&nbsp;{kredit || "anonim"}
          </span>
        )}
      </span>
    </div>
  );
}


/* Ikon menu lembar — garis 1.8 ala rujukan. */function IkonBagikan({ className = "size-6" }: { className?: string }) {
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
export function LembarLaporan({ berita: b, bahasa, onTutup, onBuka }: {
  berita: Berita; bahasa: Bahasa; onTutup: () => void; onBuka: () => void;
}) {
  const t = TEKS[bahasa];
  const [tersalin, setTersalin] = useState(false);
  /* Thumbnail lembar: foto dulu, lalu poster video. Tanpa cadangan poster,
     laporan yang isinya video saja tak punya gambar apa pun di sini dan
     lembarnya kehilangan kepalanya. */
  const gambar =
    b.gambar
    ?? b.media.find((m) => m.jenis === "gambar")?.url
    ?? b.media.find((m) => m.jenis === "video")?.poster
    ?? b.poster
    ?? null;
  /* Video utama (bila ada): thumbnail lembar berupa video autoplay, bukan
     gambar diam — sama seperti kartu umpannya. */
  const video =
    b.video
    ?? b.media.find((m) => m.jenis === "video")?.url
    ?? null;

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
    <div className="lk-lembar-latar cursor-pointer" onClick={onTutup}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={b.judul}
        onClick={(e) => e.stopPropagation()}
        className={`lk-lembar${video || gambar ? " lk-lembar-bergambar" : ""}`}
      >
        <button
          type="button"
          onClick={onTutup}
          aria-label={t.lembarTutup}
          className="lk-lembar-tutup cursor-pointer"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2"
               strokeLinecap="round" className="size-7">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
        {video ? (
          <div className="lk-lembar-gambar lk-lembar-gambar--video">
            <VideoOtomatis url={video} poster={gambar} label={b.judul} onBuka={onBuka} bahasa={bahasa} />
          </div>
        ) : (
          gambar && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={gambar} alt="" aria-hidden="true" className="lk-lembar-gambar" />
          )
        )}
        {/* Isi lembar dibungkus tersendiri karena DIA yang menggulir, bukan
            lembarnya. Lembar yang menggulir akan memotong thumbnail yang
            mencuat melewati tepi atasnya. */}
        <div className="lk-lembar-isi">
          <p className="lk-lembar-info">
            {b.tanggal}{b.lokasi ? ` • ${b.lokasi}` : ""}
          </p>
          <h2 className="lk-lembar-judul">{b.judul}</h2>
          {b.deskripsi && <p className="lk-lembar-deskripsi">{b.deskripsi}</p>}
          <button type="button" onClick={onBuka} className="lk-lembar-besar cursor-pointer">
            {t.lembarBuka}
          </button>
          <ul className="lk-lembar-menu">
            <li>
              <button type="button" onClick={bagikan} className="lk-lembar-baris cursor-pointer">
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
    </div>
  );
}

/* Titik carousel: pil gelap berisi lajur titik (aktif = pil putih
   memanjang). Satu salinan dirender di DALAM tiap slide dengan offset lajur
   yang sama, sehingga yang terlihat selalu menempel di dasar foto aktif.
   Salinan di slide non-aktif disembunyikan induknya via `inert` +
   `aria-hidden`. Navigasi lewat seret jari dan ketuk titik — tanpa panah. */
function TitikPostingan({ jumlah, idx, geser, maks, onPilih, pasangRel }: {
  jumlah: number; idx: number; geser: number; maks: number;
  onPilih: (i: number) => void;
  pasangRel: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div
      className="lk-postingan-titik"
      role="group"
      aria-label={`${idx + 1} / ${jumlah}`}
    >
      <div className={`lk-postingan-titik-jendela${jumlah > maks ? " lk-postingan-titik-jendela--geser" : ""}`}>
        <div
          ref={pasangRel}
          className="lk-postingan-titik-rel"
          style={{ transform: `translateX(${-geser}px)` }}
        >
          {Array.from({ length: jumlah }, (_, i) => {
            const jarak = Math.abs(i - idx);
            return (
              <button
                key={i}
                type="button"
                onClick={() => onPilih(i)}
                aria-label={`${i + 1} / ${jumlah}`}
                aria-current={i === idx}
                tabIndex={jarak > 2 && jumlah > maks ? -1 : undefined}
                className="lk-postingan-titik-tombol cursor-pointer"
              >
                <span
                  aria-hidden="true"
                  data-aktif={i === idx}
                  data-jarak={jarak}
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* Tampilan "Postingan" seluler ala IG — dibuka dari tap gambar di umpan
   (desktop langsung ke rincian). Bilah kembali + judul, baris penulis,
   media selebar layar (dots ketuk, tanpa geser), baris aksi (suka
   perangkat-lokal, komentar, bagikan), caption + selengkapnya + tanggal. */
export function TampilanPostingan({ laporan: l, bahasa, onTutup, onKomentar, statis = false }: {
  laporan: Laporan;
  bahasa: Bahasa;
  onTutup: () => void;
  onKomentar: () => void;
  /** true di halaman detail tersendiri: mengalir normal, bukan overlay fixed. */
  statis?: boolean;
}) {
  const t = TEKS[bahasa];
  const [idx, setIdx] = useState(0);
  const [tersalin, setTersalin] = useState(false);
  const [descPenuh, setDescPenuh] = useState(false);
  /* Geser ikut-jari ala IG: transform trek ditulis LANGSUNG ke DOM selama
     jari menempel (tanpa lewat state → tanpa re-render per frame, jadi
     60fps), dan lajur titik ikut "jalan" mengikuti kemajuan seret. State
     `idx` hanya berubah saat jari dilepas (snap) atau titik/panah ditekan. */
  const wadahRef = useRef<HTMLDivElement | null>(null);
  const trekRef = useRef<HTMLDivElement | null>(null);
  const relRefs = useRef<(HTMLDivElement | null)[]>([]);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const sentuh = useRef<{
    x: number; y: number; id: number; idxAwal: number; lebar: number;
    dx: number; tAkhir: number; kec: number;
  } | null>(null);
  // Jumlah komentar untuk angka di samping ikon — diambil sekali saat buka.
  const [jumlahKomentar, setJumlahKomentar] = useState<number | null>(null);
  useEffect(() => {
    let hidup = true;
    fetch(`/api/laporan/${l.id}/komentar`, { headers: { Accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: unknown) => {
        if (!hidup) return;
        const daftar = Array.isArray((j as { komentar?: unknown })?.komentar)
          ? ((j as { komentar: { balasan?: unknown[] }[] }).komentar)
          : [];
        setJumlahKomentar(
          daftar.reduce((n, k) => n + 1 + (Array.isArray(k.balasan) ? k.balasan.length : 0), 0),
        );
      })
      .catch(() => {
        /* gagal muat: angka disembunyikan, bukan dinolkan */
      });
    return () => {
      hidup = false;
    };
  }, [l.id]);
  // "Selengkapnya" hanya bila deskripsi benar-benar terpotong clamp —
  // diukur, bukan ditebak dari panjang teks (responsif di semua lebar).
  const descRef = useRef<HTMLSpanElement | null>(null);
  const [descTerpotong, setDescTerpotong] = useState(false);
  useEffect(() => {
    const ukur = () => {
      // Saat mengembang jangan ukur (tak terpotong) — tombolnya harus tetap
      // ada supaya bisa melipat lagi.
      if (descPenuh) return;
      const el = descRef.current;
      setDescTerpotong(!!el && el.scrollHeight > el.clientHeight + 1);
    };
    ukur();
    window.addEventListener("resize", ukur);
    return () => window.removeEventListener("resize", ukur);
  }, [l.deskripsi, descPenuh]);
  // Satu media utama bila galeri kosong (jaga-jaga): bangun dari gambar/video.
  const items = l.galeri.length > 0
    ? l.galeri
    : [{ url: "", jenis: "gambar" as const }];
  const n = items.length;
  /* Lajur titik: jendela 5 langkah (LANGKAH = lebar tombol 24 + gap 5).
     Sengaja TIDAK menengah (bukan pos-2): offset hanya bergeser saat titik
     aktif mau keluar jendela, sehingga titiknya terlihat BERJALAN dari slot
     ke slot sampai ujung — bukan diam di tengah sementara latarnya yang
     bergeser. Maju: berjalan 0→4 lalu lajur mengantar sampai titik terakhir;
     mundur sebaliknya. Saat jari menempel, offset ditulis langsung ke DOM
     mengikuti kemajuan seret (lihat tulisSeret) supaya lajurnya ikut gerak. */
  const LANGKAH_TITIK = 29;
  const MAKS_TITIK = 5;
  const offsetTitik = useCallback((pos: number) => (
    n <= MAKS_TITIK ? 0 : Math.min(Math.max(pos - (MAKS_TITIK - 1), 0), n - MAKS_TITIK) * LANGKAH_TITIK
  ), [n]);
  /* Posisi yang ditunjukkan titik — TERTINGGAL satu langkah dari foto saat
     pindah lewat ketuk: foto meluncur dulu (380ms), titik baru berjalan
     menyusul setelah foto tiba. Tanpa jeda ini, geseran lajur 29px tertutup
     gerakan trek ratusan px dan tak terlihat ("tidak ada animasi geser").
     Saat pindah lewat seret-jari, lajur sudah terlihat ikut bergerak selama
     seret (tulisSeret), jadi keduanya diperbarui sekaligus saat dilepas. */
  const [idxTitik, setIdxTitik] = useState(0);
  const tundaTitik = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geserTitik = offsetTitik(idxTitik);

  const pergiKe = useCallback((i: number) => {
    const tuju = ((i % n) + n) % n;
    setIdx(tuju);
    if (tundaTitik.current) clearTimeout(tundaTitik.current);
    // Samakan dengan durasi snap trek (380ms); gerak dikurangi = langsung.
    const jeda = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 380;
    tundaTitik.current = setTimeout(() => setIdxTitik(tuju), jeda);
  }, [n]);

  /* Bersihkan timer tunda-titik saat dibongkar. (Komponen ini selalu
     dipasang ulang per laporan, jadi tak perlu reset idx saat l.id berubah.) */
  useEffect(() => () => {
    if (tundaTitik.current) clearTimeout(tundaTitik.current);
  }, []);

  /* Wadah memeluk tinggi slide AKTIF — bukan slide tertinggi. Tanpa ini,
     galeri campur lanskap + potrait menyisakan lembah hitam sebesar selisih
     tingginya di bawah foto pendek. ResizeObserver menangkap foto yang baru
     selesai dimuat (tinggi 0 → penuh) dan rotasi layar; transisi height di
     CSS menganimasikannya berbarengan dengan luncuran trek. */
  useEffect(() => {
    const wadah = wadahRef.current;
    const slide = slideRefs.current[idx];
    if (!wadah || !slide) return;
    const terapkan = () => {
      const tinggi = slide.offsetHeight;
      if (tinggi > 0) wadah.style.height = `${tinggi}px`;
    };
    terapkan();
    if (typeof ResizeObserver === "undefined") return;
    const amati = new ResizeObserver(terapkan);
    amati.observe(slide);
    return () => amati.disconnect();
  }, [idx, n]);

  /* Tulis posisi seret langsung ke DOM (trek + semua salinan lajur titik)
     tanpa re-render — syarat 60fps saat jari bergerak. */
  const tulisSeret = useCallback((dx: number, idxAwal: number, lebar: number) => {
    const trek = trekRef.current;
    if (trek) {
      trek.style.transition = "none";
      trek.style.transform = `translateX(${-idxAwal * lebar + dx}px)`;
    }
    const dasar = offsetTitik(idxAwal - dx / lebar);
    for (const rel of [...relRefs.current]) {
      if (!rel) continue;
      rel.style.transition = "none";
      rel.style.transform = `translateX(${-dasar}px)`;
    }
  }, [offsetTitik]);

  /* Kembalikan kendali ke React (state idx) — transisi CSS menganimasikan
     snap dari posisi jari ke slide tujuan. */
  const lepasSeret = useCallback(() => {
    const trek = trekRef.current;
    if (trek) {
      trek.style.transition = "";
      trek.style.transform = "";
    }
    for (const rel of [...relRefs.current]) {
      if (!rel) continue;
      rel.style.transition = "";
      rel.style.transform = "";
    }
  }, []);

  useEffect(() => {
    const saatTombol = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onTutup();
        return;
      }
      if (n < 2) return;
      if (e.key === "ArrowLeft") pergiKe(idx - 1);
      if (e.key === "ArrowRight") pergiKe(idx + 1);
    };
    window.addEventListener("keydown", saatTombol);
    // Kunci badan hanya mode overlay — varian halaman (statis) harus bisa
    // menggulir normal.
    if (statis) {
      return () => window.removeEventListener("keydown", saatTombol);
    }
    const limpahan = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", saatTombol);
      document.body.style.overflow = limpahan;
    };
  }, [onTutup, statis, n, idx, pergiKe]);

  async function bagikan() {
    const tautan = `${window.location.origin}${l.href}`;
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: l.judul, url: tautan });
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
    <div className={`lk-postingan${statis ? " lk-postingan--statis" : ""}`} role="dialog" aria-modal="true" aria-label={l.judul}>
      <div className="lk-postingan-penulis">
        <Image src="/assets/img/logo-fire.png" alt="" aria-hidden="true" width={99} height={160} className="lk-postingan-avatar" />
        <div className="min-w-0 flex-1">
          <p className="lk-postingan-nama">Lapor Karhutla</p>
          {l.lokasi && <p className="lk-postingan-lokasi">{l.lokasi}</p>}
        </div>
      </div>

      <div
        ref={wadahRef}
        className="lk-postingan-media"
        onTouchStart={(e) => {
          if (n < 2) return;
          const s = e.touches[0];
          sentuh.current = {
            x: s.clientX, y: s.clientY, id: s.identifier,
            idxAwal: idx, lebar: wadahRef.current?.clientWidth || 320,
            dx: 0, tAkhir: performance.now(), kec: 0,
          };
        }}
        onTouchMove={(e) => {
          const awal = sentuh.current;
          if (!awal || n < 2) return;
          for (const s of Array.from(e.touches)) {
            if (s.identifier !== awal.id) continue;
            const dxMentah = s.clientX - awal.x;
            const dy = s.clientY - awal.y;
            // Gerak vertikal dominan = niat menggulir halaman — batalkan seret
            // supaya scroll vertikal tetap mulus dan tidak tertahan.
            if (Math.abs(dy) > Math.abs(dxMentah) * 1.5 && Math.abs(dy) > 12) {
              sentuh.current = null;
              lepasSeret();
              return;
            }
            // Tahanan di tepi (bagi 3) supaya ujung trek terasa "kenyal",
            // bukan mati — pola yang sama dengan carousel native.
            let dx = dxMentah;
            if ((awal.idxAwal === 0 && dx > 0) || (awal.idxAwal === n - 1 && dx < 0)) dx = dxMentah / 3;
            dx = Math.max(-awal.lebar, Math.min(awal.lebar, dx));
            // Kecepatan sentuh (px/ms, dihaluskan) untuk jentikan cepat.
            const kini = performance.now();
            const dt = Math.max(1, kini - awal.tAkhir);
            awal.kec = 0.8 * awal.kec + 0.2 * ((dx - awal.dx) / dt);
            awal.tAkhir = kini;
            awal.dx = dx;
            tulisSeret(dx, awal.idxAwal, awal.lebar);
          }
        }}
        onTouchEnd={() => {
          const awal = sentuh.current;
          sentuh.current = null;
          if (!awal || n < 2) {
            lepasSeret();
            return;
          }
          const ambang = Math.max(48, awal.lebar * 0.12);
          // Jentikan cepat (>0.5px/ms, sejauh >24px) ikut pindah walau belum
          // sampai ambang — seperti carousel native.
          const jentik = Math.abs(awal.kec) > 0.5 && Math.abs(awal.dx) > 24
            ? Math.sign(awal.kec)
            : 0;
          lepasSeret();
          // Lajur sudah terlihat ikut bergerak selama seret, jadi titik
          // diperbarui sekaligus — tanpa jeda susulan seperti jalur ketuk.
          if (tundaTitik.current) clearTimeout(tundaTitik.current);
          if (awal.dx <= -ambang || jentik < 0) {
            const tuju = (awal.idxAwal + 1) % n;
            setIdx(tuju);
            setIdxTitik(tuju);
          } else if (awal.dx >= ambang || jentik > 0) {
            const tuju = ((awal.idxAwal - 1) % n + n) % n;
            setIdx(tuju);
            setIdxTitik(tuju);
          }
        }}
        onTouchCancel={() => {
          sentuh.current = null;
          lepasSeret();
        }}
      >
        <div
          ref={trekRef}
          className="lk-postingan-trek"
          style={{ transform: `translateX(${-idx * 100}%)` }}
        >
          {items.map((m, i) => (
            <div
              key={`${m.url}-${i}`}
              ref={(el) => {
                slideRefs.current[i] = el;
              }}
              className="lk-postingan-slide"
              aria-hidden={i !== idx}
              inert={i !== idx}
            >
              {m.jenis === "video" ? (
                <VideoOtomatis url={m.url} poster={m.poster ?? l.gambar} label={l.judul} tanpaMt tanpaBuka kredit={m.keterangan ?? "anonim"} bahasa={bahasa} />
              ) : m.url ? (
                <span className="lk-media-statis">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={m.url}
                    alt={l.alt}
                    className="lk-postingan-foto"
                    loading={Math.abs(i - idx) > 1 ? "lazy" : "eager"}
                    draggable={false}
                  />
                  <span aria-hidden="true" className="lk-kredit">
                    ©&nbsp;{m.keterangan ?? "anonim"}
                  </span>
                </span>
              ) : null}
              {/* Titik menempel di tiap slide (bukan overlay wadah): tinggi tiap
                 foto beda-beda, dan tinggi wadah = slide tertinggi — overlay
                 wadah jatuh di lembah hitam jauh di bawah foto aktif sehingga
                 tak terbaca. Salinan di slide non-aktif ikut `inert` + 
                 `aria-hidden` induknya, jadi tak bisa difokus maupun terbaca
                 teknologi asistif. */}
              {n > 1 && (
                <TitikPostingan
                  jumlah={n}
                  idx={idxTitik}
                  geser={geserTitik}
                  maks={MAKS_TITIK}
                  onPilih={pergiKe}
                  pasangRel={(el) => {
                    relRefs.current[i] = el;
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="lk-postingan-aksi">
        <button type="button" onClick={onKomentar} aria-label={t.komentar} className="lk-postingan-ikon lk-postingan-komentar cursor-pointer">
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9"
               strokeLinecap="round" strokeLinejoin="round" className="size-7">
            <path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5Z" />
          </svg>
          {jumlahKomentar !== null && (
            <span aria-hidden="true">{jumlahKomentar.toLocaleString("id-ID")}</span>
          )}
        </button>
        <button type="button" onClick={bagikan} aria-label={tersalin ? t.lembarTersalin : t.lembarBagikan} className="lk-postingan-ikon cursor-pointer">
          <IkonBagikan />
        </button>
      </div>

      <div className="lk-postingan-caption">
        <p className="lk-postingan-caption-judul">{l.judul}</p>
        {l.deskripsi && (
          <p className="lk-postingan-caption-isi">
            <span ref={descRef} className={descPenuh ? "" : "lk-postingan-caption-pendek"}>{l.deskripsi}</span>{" "}
            {descTerpotong && (
              <button type="button" onClick={() => setDescPenuh((v) => !v)} className="lk-postingan-selengkapnya cursor-pointer">
                {descPenuh ? t.lebihSedikit : t.selengkapnya}
              </button>
            )}
          </p>
        )}
        <p className="lk-postingan-tanggal">{l.tanggal}</p>
      </div>
    </div>
  );
}

/* Lembar komentar seluler ala IG: gagang + judul + daftar + formulir,
   memakai sistem komentar yang sama dengan rincian (bukan tiruan).
   Lembar tulis bawaan formulir dinaikkan di atas lembar ini via CSS. */
export function LembarKomentar({ id, bahasa, onTutup }: {
  id: number; bahasa: Bahasa; onTutup: () => void;
}) {
  const t = TEKS[bahasa];
  const k = gunakanKomentar(id);

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

  return (
    <div className="lk-komentar-latar cursor-pointer" onClick={onTutup}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.komentar}
        onClick={(e) => e.stopPropagation()}
        className="lk-komentar rincian--gelap"
      >
        <span aria-hidden="true" className="lk-komentar-gagang" />
        <h2>{t.komentar}</h2>
        <div className="lk-komentar-daftar">
          <UlasanKomentar
            daftar={k.daftar}
            memuat={k.memuat}
            galat={k.galat}
            tampilkanBalasan={k.tampilkanBalasan}
            alihkanBalasan={k.alihkanBalasan}
            mulaiBalas={k.mulaiBalas}
            sebutanDari={k.sebutanDari}
            isiTanpaSebutan={k.isiTanpaSebutan}
          />
        </div>
        <div className="lk-komentar-form">
          <FormulirKomentar
            mengirim={k.mengirim}
            galat={k.galat}
            nama={k.nama}
            setNama={k.setNama}
            email={k.email}
            setEmail={k.setEmail}
            anonim={k.anonim}
            setAnonim={k.setAnonim}
            isi={k.isi}
            setIsi={k.setIsi}
            website={k.website}
            setWebsite={k.setWebsite}
            balasKe={k.balasKe}
            balasNama={k.balasNama}
            batalBalas={k.batalBalas}
            kirim={k.kirim}
            ketikRef={k.ketikRef}
            captchaRef={k.captchaRef}
            pasangCaptcha={k.pasangCaptcha}
            tanpaSheet
          />
        </div>
      </div>
    </div>
  );
}

/* Umpan masonry berkolom tetap — pola yang sama dengan MasonryKolom di index:
   kartu dibagi bergiliran (0,1,2,0,1,2…) ke sejumlah daftar terpisah, lalu
   daftar-daftar itu dijajar. Sengaja BUKAN CSS `columns`: di sana peramban
   yang memutuskan isi tiap kolom dan menghitung ulangnya setiap tinggi isi
   berubah — gambar yang baru termuat melempar kartu ke kolom lain. Di sini
   penempatan ditentukan indeks, jadi kekal: gambar yang telat hanya mendorong
   kartu di bawahnya dalam kolom yang sama. */
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
export function IkonBeranda({ className = "size-7" }: { className?: string }) {
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

export function IkonTulis({ className = "size-7" }: { className?: string }) {
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

export function IkonUmpan({ className = "size-7" }: { className?: string }) {
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
          className="mt-3 cursor-pointer rounded-full bg-[#e7e9ea] px-5 py-1.5 text-[14px] font-bold text-black transition
                     hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          {t.tulisLagi}
        </button>
    </div>
  );
}

  const galat = galatKlien || (keadaan && !keadaan.ok ? keadaan.galat : "");
  const ikonAksi = "lk-ikon-aksi cursor-pointer rounded-full p-2 text-[#ff5a26] transition hover:bg-[#ff5a26]/10 focus-visible:outline-2 focus-visible:outline-[#ff5a26]";

  return (
    <div className="rounded-xl bg-black p-4 ring-1 ring-white/5">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="lk-avatar flex size-11 shrink-0 items-center justify-center rounded-full bg-[#ff5a26]">
          <IkonOrang className="size-6 text-white" />
        </span>
        {!buka ? (
          <button
            type="button"
            id="lk-tulis"
            onClick={() => setBuka(true)}
            className="flex-1 cursor-pointer truncate py-2 text-left text-[17px] text-[#a0a0a0]/70 transition-colors hover:text-[#a0a0a0]
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
            className="lk-kirim ml-auto cursor-pointer rounded-full bg-[#e7e9ea] px-5 py-1.5 text-[15px] font-bold text-black transition
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
            <label className="lk-anonim cursor-pointer flex items-center gap-1.5 text-[13px] whitespace-nowrap text-[#a0a0a0]">
              <input type="checkbox" name="anonim" value="1" checked={anonim}
                     onChange={(e) => setAnonim(e.target.checked)}
                     className="lk-centang cursor-pointer size-4 accent-[#ff5a26]" />
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
                    className="lk-batal cursor-pointer ml-auto px-3 py-1.5 text-[14px] text-[#a0a0a0] transition hover:text-white
                               focus-visible:outline-2 focus-visible:outline-[#ff5a26]">
              {t.batal}
            </button>
            <button
              type="submit"
              disabled={mengirim || menungguToken}
              aria-busy={mengirim || menungguToken}
              className="lk-kirim cursor-pointer rounded-full bg-[#e7e9ea] px-5 py-1.5 text-[15px] font-bold text-black transition
                         hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white
                         disabled:opacity-60 disabled:cursor-not-allowed"
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
   var: custom property tidak diinterpolasi, jadi tombolnya akan melompat
   sementara kolomnya beranimasi. */
function TabRelKiri({ terbuka, onUbah, label }: {
  terbuka: boolean;
  onUbah: () => void;
  label: string;
}) {
  return (
    <span
      className={`absolute top-1/2 left-full z-[41] hidden -translate-y-1/2
                  transition-[translate] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]
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
        className="lk-tab-rel cursor-pointer group flex size-9 items-center justify-center rounded-full bg-[#ff5a26] text-black
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
  {
    bahasa,
    jumlahLaporan,
    berita = [],
    tampil = "semua",
    statistik,
  }: {
    bahasa: Bahasa;
    /** Peta butuh angka provinsi — halaman umpan tak memakainya. */
    jumlahLaporan?: Record<string, number>;
    berita?: Berita[];
    /** "semua" = dasbor (desktop dua rel; seluler hanya daftar laporan);
        "panel" = halaman panel situasi saja (peta+cuaca+statistik). */
    tampil?: "semua" | "panel";
    /** Enam angka kartu statistik dari CMS (bawaan 5.000 bila kosong). */
    sorotan?: Record<KunciSorotan, number>;
    /** Empat angka kartu statistik historis. */
    statistik?: DataStatistik[];
  },
) {
  const t = TEKS[bahasa];
  const daftarStatistik = statistik ?? ambilStatistik(bahasa);
  // Lokasi + suhu otomatis dari IP (tanpa izin geolokasi); sebelum tiba,
  // lokasi memakai teks statis dan suhu memakai garis jeda.
  const cuaca = useCuacaLokal(bahasa, t.lokasi);
  const [modeCariCuaca, setModeCariCuaca] = useState(false);
  const [kueriCuaca, setKueriCuaca] = useState("");
  const inputCuacaRef = useRef<HTMLInputElement>(null);
  const wadahSelectRef = useRef<HTMLDivElement>(null);
  const [daftarSaran, setDaftarSaran] = useState<
    Array<{
      id: string;
      nama: string;
      provinsi: string;
      lat: number;
      lng: number;
      adm4?: string;
      tipe?: string;
    }>
  >([]);
  const [memuatSaran, setMemuatSaran] = useState(false);
  const [indeksPilihan, setIndeksPilihan] = useState(-1);

  useEffect(() => {
    let aktif = true;
    if (!modeCariCuaca || !kueriCuaca.trim()) {
      const resetTimer = setTimeout(() => {
        if (!aktif) return;
        setDaftarSaran([]);
        setMemuatSaran(false);
        setIndeksPilihan(-1);
      }, 0);
      return () => {
        aktif = false;
        clearTimeout(resetTimer);
      };
    }
    const startTimer = setTimeout(() => {
      if (!aktif) return;
      setMemuatSaran(true);
    }, 0);
    const timer = setTimeout(async () => {
      try {
        const r = await fetch(`/api/cuaca-lokal?saran=${encodeURIComponent(kueriCuaca.trim())}`, {
          signal: AbortSignal.timeout(6000),
          headers: { Accept: "application/json" },
        });
        if (!aktif) return;
        if (r.ok) {
          const j = (await r.json()) as Array<{
            id: string;
            nama: string;
            provinsi: string;
            lat: number;
            lng: number;
            adm4?: string;
            tipe?: string;
          }>;
          setDaftarSaran(Array.isArray(j) ? j : []);
          setIndeksPilihan(Array.isArray(j) && j.length > 0 ? 0 : -1);
        } else {
          setDaftarSaran([]);
        }
      } catch {
        if (aktif) setDaftarSaran([]);
      } finally {
        if (aktif) setMemuatSaran(false);
      }
    }, 220);

    return () => {
      aktif = false;
      clearTimeout(startTimer);
      clearTimeout(timer);
    };
  }, [modeCariCuaca, kueriCuaca]);

  useEffect(() => {
    if (!modeCariCuaca) return;
    const tanganiKlikLuar = (e: MouseEvent) => {
      if (wadahSelectRef.current && !wadahSelectRef.current.contains(e.target as Node)) {
        setModeCariCuaca(false);
        setKueriCuaca("");
        setDaftarSaran([]);
      }
    };
    document.addEventListener("mousedown", tanganiKlikLuar);
    return () => {
      document.removeEventListener("mousedown", tanganiKlikLuar);
    };
  }, [modeCariCuaca]);
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
  // /fire/<slug> supaya bisa dibagikan, kembali ke halaman ASAL saat ditutup
  // (rute mana pun yang me-render komponen ini: /, /karhutla, /panel).
  const [sorot, setSorot] = useState<Berita | null>(null);
  // Lembar bawah seluler ("..."): pratinjau deskripsi per kartu.
  const [lembarId, setLembarId] = useState<number | null>(null);
  /* Provinsi yang ditekan di peta — pop-upnya tumbuh dari titik layar itu,
     pola yang sama dengan konsol /peta. */
  const [wilayah, setWilayah] = useState<
    { nama: string; pulau: string | null; asal: { x: number; y: number } } | null
  >(null);
  const pathAwalRef = useRef<string>("");
  const bukaRincian = useCallback(
    (b: Berita) => {
      setSorot(b);
      if (typeof window !== "undefined") {
        pathAwalRef.current = window.location.pathname;
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
    if (typeof window !== "undefined" && pathAwalRef.current && window.location.pathname !== pathAwalRef.current) {
      window.history.replaceState(null, "", pathAwalRef.current);
    }
  }, []);
  useEffect(() => {
    const saatPopState = () => {
      if (!/\/fire\/[^/]+$/.test(window.location.pathname)) {
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
  // Tap media: di seluler pindah ke halaman Postingan; di desktop langsung
  // pop-up rincian. Tanpa slug (tak bisa ditautkan) langsung pop-up juga.
  // Dibaca live (bukan state aliran) supaya selalu benar.
  const lembar = lembarId !== null ? (berita.find((b) => b.id === lembarId) ?? null) : null;
  /* Overlay peta selayar — dibuka lewat tombol bentang di sudut bingkai.
     Di-render di portal body, tapi petanya BUKAN instance kedua: node <Peta>
     yang sudah hidup dipindah ke sini (lihat hostPeta di bawah). */
  const [petaPenuh, setPetaPenuh] = useState(false);
  /* Fase tutup: overlay bertahan selama animasi keluar, baru dilepas — tanpa
     ini petanya lompat balik ke bingkai tanpa transisi. */
  const [menutupPenuh, setMenutupPenuh] = useState(false);
  const menutupRef = useRef(false);
  const tutupPenuh = useCallback(() => {
    if (menutupRef.current) return;
    menutupRef.current = true;
    setMenutupPenuh(true);
    setTimeout(() => {
      menutupRef.current = false;
      setMenutupPenuh(false);
      setPetaPenuh(false);
    }, DURASI_TUTUP_PETA);
  }, []);

  /* Escape menutup overlay — pola yang sama dengan pop-up lain di konsol.
     Badan dikunci supaya roda/sentuh di belakang overlay tak ikut menggulir
     halaman. */
  useEffect(() => {
    if (!petaPenuh) return;
    const tekan = (e: KeyboardEvent) => {
      if (e.key === "Escape") tutupPenuh();
    };
    window.addEventListener("keydown", tekan);
    const limpahan = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", tekan);
      document.body.style.overflow = limpahan;
    };
  }, [petaPenuh, tutupPenuh]);

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
    const SASARAN = 0.65;
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
      /* Selagi membentang selayar, node peta tinggal di overlay: slot ini
         kosong dan skalanya tak berlaku lagi. */
      if (panggung.matches && !petaPenuh) {
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
  }, [petaPenuh]);

  /* SATU instance <Peta> untuk bingkai kecil DAN overlay selayar. Node-nya
     dipindah antar slot lewat appendChild; React merendernya ke wadah lepas
     ini sekali saja, jadi tak ada pemasangan ulang.

     Instance kedua — pola sebelumnya — berarti MapLibre baru, konteks WebGL
     baru, dan 61 frame sebaran asap diunduh ulang ke cache instance itu:
     itulah kedipan saat membentang, walau peta kecilnya sudah lama siap.
     Kanvas tetap hidup saat dipindah; MapLibre menyesuaikan diri lewat
     ResizeObserver miliknya di peta-asap.tsx. */
  /* Wadahnya baru ada SESUDAH pasang. Bukan kerewelan: server tak merender
     portal sama sekali, jadi render pertama klien harus ikut kosong — kalau
     tidak, portalnya sudah ada saat hidrasi sementara HTML server tidak dan
     React membuang seluruh pohon ini ("Hydration failed").

     Gerbangnya useSyncExternalStore, bukan setState di effect: snapshot server
     (false) yang dipakai React saat hidrasi itulah yang menjamin kecocokan,
     dan aturan set-state-in-effect repo ini melarang jalur satunya. */
  const terpasang = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [wadahPeta] = useState<HTMLDivElement | null>(() => {
    if (typeof document === "undefined") return null;
    const el = document.createElement("div");
    el.style.cssText = "position:absolute;inset:0";
    return el;
  });
  const hostPeta = terpasang ? wadahPeta : null;
  const slotPenuhRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const tujuan = petaPenuh ? slotPenuhRef.current : isiPetaRef.current;
    if (hostPeta && tujuan && hostPeta.parentNode !== tujuan) tujuan.appendChild(hostPeta);
  }, [hostPeta, petaPenuh]);
  /* Umpan langsung dari basis data — SELURUH kejadian tayang, terbaru dulu,
     sama seperti arsip di index. Media utama (video pertama, kalau tidak foto
     pertama) untuk tampilan tunggal; galeri penuh untuk carousel kartu
     bermedia banyak; tanpa media sama sekali kartunya memakai placeholder. */
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
          galeri: b.media
            .filter((m) => (m.jenis === "gambar" || m.jenis === "video") && m.url)
            .map((m) => ({ url: m.url, jenis: m.jenis, poster: m.poster, keterangan: m.keterangan })),
          alt: b.alt,
          judul: b.judul,
          tanggal: b.tanggal,
          lokasi: b.lokasi ?? b.provinsi,
          deskripsi: b.deskripsi,
          slug: b.slug,
          href: b.slug ? `/${bahasa}/fire/${b.slug}` : `/${bahasa}`,
        };
      }),
    [berita, bahasa],
  );
  const kata = cari.trim().toLowerCase();
  const hasil = laporan.filter((l) => l.judul.toLowerCase().includes(kata));
  // Jumlah kolom umpan stabil menurut lebar layar (3 kolom di desktop),
  // bukan berganti 3<->4 saat rel ditutup-buka. Pergantian kolom merombak
  // seluruh partisi kartu (isi[i % kolom]) yang membuat kartu meloncat
  // antar-kolom dan memicu kedipan/flickering pada gambar dan layout.
  const kolom = gunakanKolomUmpan(true);
  const bukaMedia = useCallback(
    (id: number) => {
      const panggung = window.matchMedia("(min-width: 1100px) and (min-height: 640px)").matches;
      if (panggung) {
        bukaDariId(id);
        return;
      }
      const l = laporan.find((x) => x.id === id);
      if (l?.slug) {
        router.push(`/${bahasa}/fire/${l.slug}`);
      } else {
        bukaDariId(id);
      }
    },
    [bukaDariId, laporan, bahasa, router],
  );
  const [komentarId, setKomentarId] = useState<number | null>(null);

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
        style={{
          "--lk-kiri": LEBAR_REL_KIRI,
          "--kolom-kiri": kiriBuka
            ? "minmax(0,calc(var(--lk-kiri) + 0.5rem))"
            : "minmax(0,0px)",
          "--kolom-kanan": kiriBuka
            ? "minmax(0,calc(100% - var(--lk-kiri) - 0.5rem))"
            : "minmax(0,100%)",
        } as React.CSSProperties}
        className={`lk-isi relative grid w-full gap-2 aliran:gap-2 p-2 aliran:grid-cols-1 panggung:gap-0${tampil === "panel" ? " lk-penuh-mobile" : ""}
                   panggung:grid-cols-[var(--kolom-kiri)_var(--kolom-kanan)]
                   panggung:transition-[grid-template-columns] panggung:duration-500
                   panggung:ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none`}
      >
        {/* ── Rel kiri: instrumen ──
            Tanpa panel sendiri: isinya berdiri langsung di atas latar halaman,
            dan kartu-kartu hitam di dalamnyalah yang memberi bentuk. */}
        {panelTerlihat && (
          <div
            className={`min-h-0 min-w-0 relative ${
              tampil === "semua" ? "aliran:hidden panggung:block" : "w-full"
            } panggung:col-start-1 panggung:row-start-1 panggung:h-full panggung:z-30`}
          >
            {/* Pembungkus tirai: memotong rel selebar lajur grid. Rel di dalamnya
                tetap selebar penuh (shrink-0) dan menempel ke tepi kanan lajur (justify-end),
                sehingga saat dilipat ia bergeser masuk ke balik bingkai kiri tanpa
                membuat teks atau kartu di dalamnya terlipat/menciut. */}
            <div className="min-h-0 min-w-0 panggung:h-full panggung:w-full panggung:overflow-hidden panggung:flex panggung:justify-end">
              <aside
                id="lk-rel-kiri"
                aria-label={t.situasi}
                inert={!kiriBuka}
                className={`lk-kiri min-h-0 min-w-0 px-2 pt-1
                           panggung:w-[var(--lk-kiri)] panggung:shrink-0 panggung:mr-2
                           panggung:transition-opacity panggung:duration-500 panggung:ease-[cubic-bezier(0.22,1,0.36,1)]
                           motion-reduce:transition-none panggung:[contain:layout_paint]
                           ${kiriBuka ? "panggung:opacity-100" : "panggung:opacity-0 panggung:pointer-events-none"}
                           ${tampil === "semua" ? " lk-hanya-panggung" : ""}`}
              >
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
            {/* Slot bingkai kecil — isinya hostPeta, ditempelkan lewat effect. */}
            <div ref={isiPetaRef} className="lk-peta-isi" />
          </div>
          {/* Instance <Peta> satu-satunya. Dirender ke wadah lepas (hostPeta)
              yang dipindah antara slot bingkai dan slot overlay; prop yang
              berbeda antar kedua tempat cukup ikut `petaPenuh`.
              zoomRoda hanya menyala di selayar: di bingkai kecil halaman masih
              menggulir, jadi roda yang dibajak peta akan mengunci guliran. */}
          {hostPeta
            ? createPortal(
                <Peta
                  jumlahLaporan={jumlahLaporan ?? {}}
                  /* Provinsi bisa ditekan seperti di konsol: pop-upnya memakai
                     komponen dan data yang sama (berita + hitungan provinsi). */
                  onPilihWilayah={(nama, pulau, asal) => setWilayah({ nama, pulau, asal })}
                  isPenuh={petaPenuh}
                  legendaRingkas={!petaPenuh}
                  tombolRapat
                  muatNusantara
                  zoomRoda={petaPenuh}
                  onExpand={petaPenuh ? null : () => setPetaPenuh(true)}
                  expandLabel={t.bukaPetaSelayar}
                />,
                hostPeta,
              )
            : null}
          {/* Overlay selayar — hanya cangkang: peta, tombol tutup, pop-up.
              Portal ke body: bingkai memakai `isolate`, fixed di dalamnya
              tertahan (pola komposer-lapor/popup-peta). */}
          {petaPenuh
            ? createPortal(
                <div
                  id="lk-peta-selayar"
                  role="dialog"
                  aria-modal="true"
                  aria-label={t.bukaPetaSelayar}
                  className={`lk-peta-penuh fixed inset-0 z-[70] bg-[#0a0a0a]${menutupPenuh ? " lk-peta-penuh--tutup" : ""}`}
                >
                  <div ref={slotPenuhRef} className="absolute inset-0" />
                  <button
                    type="button"
                    onClick={tutupPenuh}
                    title={t.tutupPetaSelayar}
                    aria-label={t.tutupPetaSelayar}
                    className="lk-tutup-peta cursor-pointer pointer-events-auto absolute right-4 top-4 z-[1100] flex size-9 items-center justify-center rounded-full
                               bg-black/70 text-white ring-1 ring-white/15 backdrop-blur-sm
                               transition hover:scale-105 hover:ring-[#ff5a26]/70 active:scale-95
                               motion-reduce:transition-none motion-reduce:hover:scale-100
                               focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none"
                  >
                    <IkonTutup className="size-4" />
                  </button>
                  {/* Pop-up provinsi DI DALAM portal selayar. Latarnya z-44,
                      sedangkan overlay ini z-70 — dipasang di tingkat halaman
                      ia akan tertimbun peta dan tak pernah terlihat. Di sini ia
                      ikut konteks penumpukan overlay, jadi tampil di atas peta
                      tanpa perlu mengubah z-index komponen bersamanya. */}
                  {wilayah && (
                    <PopupPeta
                      nama={wilayah.nama}
                      pulau={wilayah.pulau}
                      jumlah={jumlahLaporan?.[wilayah.nama] ?? null}
                      asal={wilayah.asal}
                      berita={berita}
                      jumlahLaporan={jumlahLaporan ?? {}}
                      onBukaRincian={(i) => {
                        const ketemu = berita[i];
                        if (!ketemu) return;
                        // Rincian juga z-70: tutup petanya dulu supaya tidak
                        // beradu di lapisan yang sama.
                        setWilayah(null);
                        setPetaPenuh(false);
                        bukaRincian(ketemu);
                      }}
                      onTutup={() => setWilayah(null)}
                      gelap
                    />
                  )}
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
              className="lk-lembar-gagang cursor-pointer"
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
            <div
              ref={wadahSelectRef}
              className={`lk-lokasi relative hidden panggung:flex items-center gap-3 rounded-xl px-5 py-4 text-[13px] sm:text-[15px] transition-all ${
                modeCariCuaca
                  ? "bg-[#161616] border border-white/20 shadow-xl ring-1 ring-white/10"
                  : "bg-black/50 border border-white/5 hover:bg-black/70"
              }`}
            >
              {modeCariCuaca ? (
                <div className="flex w-full items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      if (indeksPilihan >= 0 && indeksPilihan < daftarSaran.length) {
                        await cuaca.pilihSaran(daftarSaran[indeksPilihan]);
                      } else if (kueriCuaca.trim()) {
                        await cuaca.cari(kueriCuaca);
                      }
                      setModeCariCuaca(false);
                      setKueriCuaca("");
                      setDaftarSaran([]);
                    }}
                    disabled={cuaca.memuat}
                    aria-label={t.cariLokasiCuacaAria}
                    className="text-[#a0a0a0] transition-colors hover:text-white"
                  >
                    <IkonCari className="size-[18px] shrink-0" />
                  </button>
                  <input
                    ref={inputCuacaRef}
                    type="text"
                    value={kueriCuaca}
                    onChange={(e) => setKueriCuaca(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === "Escape") {
                        e.preventDefault();
                        setModeCariCuaca(false);
                        setKueriCuaca("");
                        setDaftarSaran([]);
                      } else if (e.key === "ArrowDown") {
                        e.preventDefault();
                        if (daftarSaran.length > 0) {
                          setIndeksPilihan((idx) => (idx + 1) % daftarSaran.length);
                        }
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        if (daftarSaran.length > 0) {
                          setIndeksPilihan((idx) => (idx - 1 + daftarSaran.length) % daftarSaran.length);
                        }
                      } else if (e.key === "Enter") {
                        e.preventDefault();
                        if (indeksPilihan >= 0 && indeksPilihan < daftarSaran.length) {
                          await cuaca.pilihSaran(daftarSaran[indeksPilihan]);
                          setModeCariCuaca(false);
                          setKueriCuaca("");
                          setDaftarSaran([]);
                        } else if (kueriCuaca.trim()) {
                          await cuaca.cari(kueriCuaca);
                          setModeCariCuaca(false);
                          setKueriCuaca("");
                          setDaftarSaran([]);
                        }
                      }
                    }}
                    placeholder={t.cariLokasiCuaca}
                    className="min-w-0 flex-1 bg-transparent text-[13px] text-[#f5f5f5] placeholder:text-[#707070] focus:outline-none sm:text-[15px]"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setModeCariCuaca(false);
                      setKueriCuaca("");
                      setDaftarSaran([]);
                    }}
                    aria-label={t.batalCariCuaca}
                    className="text-[#a0a0a0] transition-colors hover:text-white"
                  >
                    <IkonTutup className="size-4 shrink-0" />
                  </button>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setModeCariCuaca(true);
                      setTimeout(() => inputCuacaRef.current?.focus(), 50);
                    }}
                    aria-label={t.cariLokasiCuacaAria}
                    className="text-[#a0a0a0] transition-colors hover:text-white"
                  >
                    <IkonCari className="size-[18px] shrink-0" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setModeCariCuaca(true);
                      setTimeout(() => inputCuacaRef.current?.focus(), 50);
                    }}
                    className="min-w-0 flex-1 truncate text-left transition-colors hover:text-white focus:outline-none"
                    title={cuaca.lokasi}
                  >
                    <span className="truncate" aria-live="polite">
                      {cuaca.lokasi}
                      <span className="text-[#a0a0a0]">
                        /{cuaca.sumberLokasi === "gps"
                          ? t.lokasiTerdeteksi
                          : cuaca.sumberLokasi === "cari"
                          ? t.lokasiDicari
                          : t.lokasiOtomatis}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => cuaca.deteksiGps()}
                    disabled={cuaca.memuat}
                    aria-label={t.deteksiGpsCuacaAria}
                    className="ml-auto text-[#a0a0a0] transition-colors hover:text-white disabled:opacity-50"
                  >
                    <IkonLokasi className={`size-[22px] shrink-0 ${cuaca.memuat ? "animate-spin" : ""}`} />
                  </button>
                </>
              )}

              {/* Dropdown Select2 mengambang tepat di bawah bilah pencarian */}
              {modeCariCuaca && (kueriCuaca.trim() !== "" || memuatSaran || daftarSaran.length > 0) && (
                <div
                  role="listbox"
                  aria-label={bahasa === "en" ? "Location suggestions" : "Saran lokasi"}
                  className="absolute top-full left-0 right-0 mt-2 z-50 max-h-60 overflow-y-auto rounded-xl border border-white/15 bg-[#1a1a1a]/95 p-1.5 shadow-2xl backdrop-blur-xl"
                >
                  {memuatSaran && daftarSaran.length === 0 ? (
                    <div className="flex items-center gap-2.5 px-3 py-3 text-[13px] text-[#a0a0a0]">
                      <svg
                        className="size-4 shrink-0 animate-spin text-white"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="3"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                        />
                      </svg>
                      <span>{bahasa === "en" ? "Searching locations..." : "Mencari lokasi..."}</span>
                    </div>
                  ) : daftarSaran.length > 0 ? (
                    daftarSaran.map((item, idx) => {
                      const dipilih = idx === indeksPilihan;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          role="option"
                          aria-selected={dipilih}
                          onMouseEnter={() => setIndeksPilihan(idx)}
                          onClick={async () => {
                            await cuaca.pilihSaran(item);
                            setModeCariCuaca(false);
                            setKueriCuaca("");
                            setDaftarSaran([]);
                          }}
                          className={`group flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[13px] transition-colors ${
                            dipilih
                              ? "bg-white/15 text-white"
                              : "text-[#d0d0d0] hover:bg-white/10 hover:text-white"
                          }`}
                        >
                          <IkonPin
                            className={`size-4 shrink-0 ${
                              dipilih ? "text-orange-400" : "text-[#888888] group-hover:text-orange-400"
                            }`}
                          />
                          <span className="truncate font-medium">{item.nama}</span>
                          <span className="ml-auto shrink-0 rounded bg-white/5 px-2 py-0.5 text-[11px] text-[#909090]">
                            {item.provinsi}
                          </span>
                        </button>
                      );
                    })
                  ) : (
                    <div className="px-3 py-3 text-center text-[13px] text-[#888888]">
                      {bahasa === "en" ? "No locations found" : "Tidak ada lokasi yang cocok"}
                    </div>
                  )}
                </div>
              )}
            </div>
            <p className="lk-angka mt-0 panggung:mt-4 flex items-center gap-4 px-3 pb-1 text-[clamp(44px,3.8vw,68px)] leading-none font-semibold"
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

          {/* Empat angka situasi — mx-4: sejajar dengan panel cuaca, menengah
              terhadap peta. Kartu diberi min-w-0 + padding ramping supaya angka
              tidak meluap di rel sempit. */}
          <dl className="mx-4 mt-4 grid grid-cols-2 gap-3">
            {daftarStatistik.map((s, idx) => (
              <div key={s.keterangan || idx} className="flex min-w-0 flex-col justify-center rounded-2xl bg-[#1e1e1e] px-3 py-6 text-center">
                <dd className="lk-angka order-1 text-[clamp(20px,1.8vw,32px)] leading-tight font-medium text-[#f5f5f5]">
                  {s.nilai}
                </dd>
                <dt className="order-2 mt-2 text-[12px] leading-tight font-medium text-balance sm:text-[13px] text-[#a0a0a0]">
                  {s.keterangan}
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
            </div>

            {tampil === "semua" && (
              <TabRelKiri
                terbuka={kiriBuka}
                onUbah={() => setKiriBuka((b) => !b)}
                label={kiriBuka
                  ? (bahasa === "en" ? "Collapse situation panel" : "Tutup panel situasi")
                  : (bahasa === "en" ? "Open situation panel" : "Buka panel situasi")}
              />
            )}
          </div>
        )}

        {/* ── Rel kanan: umpan laporan ──
            Halaman utama seluler: daftar gambar/video.

            Saat rel dilipat, isinya sengaja dibiarkan memakai lebar penuh —
            tanpa batas lebar dan tanpa pemusatan. */}
        {umpanTerlihat && (
          <main
            aria-label={t.umpan}
            className="lk-kanan pantau-rel min-h-0 min-w-0 panggung:col-start-2 panggung:row-start-1"
          >
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
                          onClick={() => bukaMedia(l.id)}
                          className="cursor-pointer text-left transition-colors hover:text-[#ff5a26] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff5a26]"
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
                        className="lk-kartu-titik cursor-pointer shrink-0 rounded-full p-1.5 text-[#f5f5f5] transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-[#ff5a26]"
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
                    <span className="lk-media-statis">
                      <VideoOtomatis
                        url={l.video}
                        poster={l.gambar}
                        label={l.judul}
                        onBuka={() => bukaMedia(l.id)}
                        bahasa={bahasa}
                      />
                      {l.galeri.length > 1 && (
                        <span aria-hidden="true" className="lk-galeri-lencana">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                               strokeLinecap="round" strokeLinejoin="round">
                            <rect x="8" y="8" width="12" height="12" rx="2.5" fill="rgb(0 0 0 / 0.35)" />
                            <path d="M16 8V6.5A2.5 2.5 0 0 0 13.5 4H6.5A2.5 2.5 0 0 0 4 6.5v7A2.5 2.5 0 0 0 6.5 16H8" />
                          </svg>
                        </span>
                      )}
                    </span>
                  ) : l.gambar ? (
                    <button
                      type="button"
                      onClick={() => bukaMedia(l.id)}
                      aria-label={l.judul}
                      className="lk-foto cursor-pointer relative mt-3 block w-full transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff5a26] hover:brightness-95"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={l.gambar} alt={l.alt} loading="lazy" draggable={false} className="lk-foto h-auto w-full" />
                      {l.galeri.length > 1 && (
                        <span aria-hidden="true" className="lk-galeri-lencana">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                               strokeLinecap="round" strokeLinejoin="round">
                            <rect x="8" y="8" width="12" height="12" rx="2.5" fill="rgb(0 0 0 / 0.35)" />
                            <path d="M16 8V6.5A2.5 2.5 0 0 0 13.5 4H6.5A2.5 2.5 0 0 0 4 6.5v7A2.5 2.5 0 0 0 6.5 16H8" />
                          </svg>
                        </span>
                      )}
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
          className="cursor-pointer rounded-full p-2 text-[#f5f5f5] transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-[#ff5a26]"
        >
          <IkonBeranda />
        </Link>
        {tampil === "panel" ? (
          <Link
            href={`/${bahasa}`}
            aria-label={t.tabUmpan}
            className="cursor-pointer rounded-full p-2 text-[#f5f5f5] transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-[#ff5a26]"
          >
            <IkonUmpan />
          </Link>
        ) : (
          <Link
            href={`/${bahasa}/karhutla/panel`}
            aria-label={t.tabPanel}
            className="cursor-pointer rounded-full p-2 text-[#f5f5f5] transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-[#ff5a26]"
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
              className="cursor-pointer rounded-full p-2 text-[#f5f5f5] transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-[#ff5a26]"
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
              className="cursor-pointer rounded-full p-2 text-[#f5f5f5] transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-[#ff5a26]"
            >
              <IkonPlus />
            </button>
          </>
        ) : (
          <>
            <Link
              href={`/${bahasa}/karhutla`}
              aria-label={t.tabTulis}
              className="cursor-pointer rounded-full p-2 text-[#f5f5f5] transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-[#ff5a26]"
            >
              <IkonPlus />
            </Link>
            <Link
              href={`/${bahasa}/lapor`}
              aria-label={t.tabLapor}
              className="cursor-pointer rounded-full p-2 text-[#f5f5f5] transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-[#ff5a26]"
            >
              <IkonTulis />
            </Link>
          </>
        )}
      </nav>
      <div aria-hidden="true" className="lk-tabbar-ruang" />

      {/* Rincian di halaman yang sama seperti index (URL ikut pindah agar
          bisa dibagikan, isi halaman tetap). */}
      {sorot && (
        <RincianLaporan berita={sorot} bahasa={bahasa} onTutup={tutupRincian} gelap />
      )}

      {/* Pop-up provinsi untuk peta INLINE. Digerbangi !petaPenuh karena versi
          selayar punya salinannya sendiri di dalam portal — tanpa gerbang ini
          keduanya akan terpasang bersamaan dari satu state yang sama. */}
      {wilayah && !petaPenuh && (
        <PopupPeta
          nama={wilayah.nama}
          pulau={wilayah.pulau}
          jumlah={jumlahLaporan?.[wilayah.nama] ?? null}
          asal={wilayah.asal}
          berita={berita}
          jumlahLaporan={jumlahLaporan ?? {}}
          onBukaRincian={(i) => {
            const ketemu = berita[i];
            if (!ketemu) return;
            setWilayah(null);
            bukaRincian(ketemu);
          }}
          onTutup={() => setWilayah(null)}
          gelap
        />
      )}

      {/* Lembar deskripsi seluler dari tombol "...". */}
      {lembar && (
        <LembarLaporan
          berita={lembar}
          bahasa={bahasa}
          onTutup={() => setLembarId(null)}
          onBuka={() => {
            // Ke halaman detail, bukan pop-up.
            const slug = lembar.slug;
            setLembarId(null);
            if (slug) {
              router.push(`/${bahasa}/fire/${slug}`);
            } else {
              bukaRincian(lembar);
            }
          }}
        />
      )}

      {/* Lembar komentar seluler dari ikon komentar postingan. */}
      {komentarId !== null && (
        <LembarKomentar
          id={komentarId}
          bahasa={bahasa}
          onTutup={() => setKomentarId(null)}
        />
      )}
    </div>
  );
}
