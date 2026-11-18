"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { RemoteParticipant, RemoteTrackPublication, Room } from "livekit-client";
import type { Bahasa } from "@/lib/bahasa";
import { IkonSuara, IkonTutup } from "./ikon";
import { TEKS } from "./teks";

/*
 * Siaran langsung warga dari aplikasi (LiveKit) di umpan beranda situs.
 * Kontraknya sama dengan beranda aplikasi (docs/LIVE.md di repo laporin-apps):
 *
 * - Daftar: GET /api/mobile/live — hanya siaran publik, titik kasar, tanpa
 *   siaran yang sudah dilaporkan beberapa akun. Server membagi hasilnya 5 dtk.
 * - Kartu: video bisu dengan tiket pratinjau (`pratinjau: true`), yaitu
 *   peserta tersembunyi yang tidak dihitung penonton dan tidak memakan kursi
 *   warga. Hanya kamera pelapor yang dilanggan, paling tinggi lapisan bawah
 *   (±180p), dan hanya selama kartunya terlihat.
 * - Klik: tiket penonton warga tanpa akun — video bersuara, hanya menonton
 *   (canPublishData false). Komentar penonton lain di aplikasi tetap terbaca.
 */

const AWALAN_PELAPOR = "pelapor-";
const TOPIK_KOMENTAR = "komentar";
const BATAS_KOMENTAR = 200;
/** Daftar dimuat ulang tiap 8 dtk selama tab terlihat, sama dengan aplikasi. */
const JEDA_MUAT_MS = 8_000;
/** Gagal beruntun menjarangkan polling sampai sekali per 2 menit. */
const JEDA_MAKS_MUAT_MS = 120_000;
/** Kartu yang boleh memutar pratinjau sekaligus. */
const MAKS_PRATINJAU = 6;
/** Jeda sebelum mencoba lagi pratinjau, menurut gagal beruntun (pola aplikasi). */
const JEDA_ULANG_MS = [0, 3000, 10_000, 30_000];
/** Tiket pratinjau berumur 10 menit di server; dipakai ulang sampai 9 menit. */
const UMUR_TIKET_MS = 9 * 60_000;

export type SiaranPublik = {
  ruang: string;
  judul: string;
  nama: string;
  /** Epoch ms. */
  mulai: number;
  penonton: number;
};

type Tiket = { url: string; token: string };
type HasilTiket = { ok: true; tiket: Tiket } | { ok: false; status: number; ulang: boolean };

function siaranSah(x: unknown): x is SiaranPublik {
  const s = x as Partial<SiaranPublik> | null;
  return typeof s?.ruang === "string" && typeof s.judul === "string" && typeof s.mulai === "number";
}

/** Siaran publik yang sedang berjalan, terbaru dulu (urutan server — kartu
 *  tidak berpindah tempat setiap jumlah penontonnya berubah). Gagal = daftar
 *  lama tetap dipakai. */
function useSiaranPublik(): SiaranPublik[] {
  const [daftar, setDaftar] = useState<SiaranPublik[]>([]);

  useEffect(() => {
    let batal = false;
    let gagal = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const jadwal = () => {
      if (batal) return;
      clearTimeout(timer);
      timer = setTimeout(muat, Math.min(JEDA_MUAT_MS * 2 ** gagal, JEDA_MAKS_MUAT_MS));
    };
    const muat = async () => {
      // Tab di latar tidak memuat apa pun; begitu terlihat lagi langsung dimuat.
      if (document.visibilityState !== "visible") return jadwal();
      try {
        const r = await fetch("/api/mobile/live", { cache: "no-store" });
        const isi: unknown = r.ok ? await r.json() : null;
        if (!Array.isArray(isi)) throw new Error(`HTTP ${r.status}`);
        gagal = 0;
        const baru = isi.filter(siaranSah).map((s) => ({
          ruang: s.ruang, judul: s.judul, nama: String(s.nama || "Warga"),
          mulai: s.mulai, penonton: Number(s.penonton) || 0,
        }));
        if (!batal) setDaftar((lama) => (JSON.stringify(lama) === JSON.stringify(baru) ? lama : baru));
      } catch {
        gagal++;
      }
      jadwal();
    };
    const saatTerlihat = () => {
      if (document.visibilityState !== "visible") return;
      clearTimeout(timer);
      void muat();
    };

    void muat();
    document.addEventListener("visibilitychange", saatTerlihat);
    return () => {
      batal = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", saatTerlihat);
    };
  }, []);

  return daftar;
}

/** Tiket LiveKit dari situs. 429/5xx = boleh dicoba lagi; 403/404 = tidak
 *  (bukan siaran publik, sudah berakhir). */
async function mintaTiket(ruang: string, pratinjau: boolean): Promise<HasilTiket> {
  try {
    const r = await fetch("/api/mobile/live/tonton", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pratinjau ? { ruang, pratinjau: true } : { ruang }),
      cache: "no-store",
    });
    const isi = (await r.json().catch(() => null)) as { url?: string; token?: string } | null;
    if (r.ok && isi?.url && isi.token) return { ok: true, tiket: { url: isi.url, token: isi.token } };
    return { ok: false, status: r.status, ulang: r.status === 429 || r.status >= 500 };
  } catch {
    return { ok: false, status: 0, ulang: true };
  }
}

/** Tiket pratinjau per ruang, dipakai ulang setiap kartunya kembali terlihat. */
const tiketPratinjau = new Map<string, Tiket & { sampai: number }>();

/** true selama elemennya setidaknya separuh terlihat. */
function useTerlihat<T extends Element>(ref: React.RefObject<T | null>): boolean {
  const [terlihat, setTerlihat] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const pengamat = new IntersectionObserver(([e]) => setTerlihat(e.isIntersecting), { threshold: 0.5 });
    pengamat.observe(el);
    return () => pengamat.disconnect();
  }, [ref]);
  return terlihat;
}

function useHalamanTerlihat(): boolean {
  return useSyncExternalStore(
    (ubah) => {
      document.addEventListener("visibilitychange", ubah);
      return () => document.removeEventListener("visibilitychange", ubah);
    },
    () => document.visibilityState === "visible",
    () => true,
  );
}

/** Penghemat data peramban (Chrome Android): kartu tanpa video. */
function hematData(): boolean {
  return (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
}

const inisial = (nama: string) => (nama.trim()[0] ?? "W").toUpperCase();

function waktuLalu(mulai: number, kini: number, bahasa: Bahasa): string {
  const menit = Math.floor((kini - mulai) / 60_000);
  if (menit < 1) return bahasa === "en" ? "just started" : "baru mulai";
  const rtf = new Intl.RelativeTimeFormat(bahasa, { numeric: "always" });
  return menit < 60 ? rtf.format(-menit, "minute") : rtf.format(-Math.floor(menit / 60), "hour");
}

const durasi = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const mm = `${String(Math.floor(s / 60) % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  return s >= 3600 ? `${Math.floor(s / 3600)}:${mm}` : mm;
};

/**
 * Deret "Sedang live" di atas umpan laporan: tidak menggambar apa pun selama
 * tidak ada siaran publik. Kartu memutar videonya tanpa suara; klik membuka
 * pemutar bersuara.
 */
export function DeretanLive({ bahasa }: { bahasa: Bahasa }) {
  const t = TEKS[bahasa];
  const daftar = useSiaranPublik();
  const halamanTerlihat = useHalamanTerlihat();
  const [dipilih, setDipilih] = useState<SiaranPublik | null>(null);
  const [kini, setKini] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setKini(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Data terbaru (jumlah penonton) selama siarannya masih di daftar.
  const ditonton = dipilih && (daftar.find((s) => s.ruang === dipilih.ruang) ?? dipilih);
  const angka = new Intl.NumberFormat(bahasa, { notation: "compact" });

  return (
    <>
      {daftar.length > 0 && (
        <section aria-label={t.liveDeret} className="mt-5">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-tinta dark:text-[#f5f5f5] sm:text-[16px]">
            <span aria-hidden="true" className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#ff4a1c] opacity-75 motion-reduce:hidden" />
              <span className="relative inline-flex size-2.5 rounded-full bg-[#ff4a1c]" />
            </span>
            {t.liveJudul}
            <span className="font-normal text-black/50 dark:text-white/50">{daftar.length}</span>
          </h2>
          <ul className="mt-3 flex snap-x gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]">
            {daftar.map((s, i) => (
              <KartuLive
                key={s.ruang}
                siaran={s}
                bahasa={bahasa}
                kini={kini}
                angka={angka}
                // Pemutar bersuara terbuka = pratinjau dilepas: satu sambungan saja.
                bolehPutar={halamanTerlihat && !dipilih && i < MAKS_PRATINJAU}
                onTonton={() => setDipilih(s)}
              />
            ))}
          </ul>
        </section>
      )}
      {ditonton && (
        <TontonLive key={ditonton.ruang} siaran={ditonton} bahasa={bahasa} angka={angka} onTutup={() => setDipilih(null)} />
      )}
    </>
  );
}

function KartuLive({ siaran: s, bahasa, kini, angka, bolehPutar, onTonton }: {
  siaran: SiaranPublik;
  bahasa: Bahasa;
  kini: number;
  angka: Intl.NumberFormat;
  bolehPutar: boolean;
  onTonton: () => void;
}) {
  const t = TEKS[bahasa];
  const ref = useRef<HTMLLIElement | null>(null);
  const terlihat = useTerlihat(ref);
  return (
    <li ref={ref} className="w-[148px] shrink-0 snap-start sm:w-[176px]">
      <button
        type="button"
        onClick={onTonton}
        aria-label={`${t.liveTonton} ${s.nama}: ${s.judul} — ${s.penonton} ${t.liveMenonton}`}
        className="group block w-full cursor-pointer text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff5a26]"
      >
        <span className="relative block aspect-[3/4] overflow-hidden rounded-lg bg-[#1d1b1a]">
          <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
            <span className="rounded-full border-2 border-[#ff4a1c] p-0.5">
              <span className="flex size-12 items-center justify-center rounded-full bg-white/10 text-[18px] font-semibold text-white">
                {inisial(s.nama)}
              </span>
            </span>
          </span>
          <PratinjauLive ruang={s.ruang} putar={bolehPutar && terlihat} />
          <LencanaLive />
          <span className="absolute right-2 top-2 flex h-6 items-center gap-1 rounded-md bg-black/55 px-1.5 text-[11px] font-semibold tabular-nums text-white">
            <IkonMata />
            {angka.format(s.penonton)}
          </span>
        </span>
        <span className="mt-2 line-clamp-2 block text-[14px] leading-snug font-semibold text-pretty text-tinta transition-colors group-hover:text-[#ff5a26] dark:text-[#f5f5f5]">
          {s.judul}
        </span>
        <span className="mt-1 block truncate text-[11px] tracking-wide text-black/55 uppercase dark:text-white/60">
          {s.nama} · {waktuLalu(s.mulai, kini, bahasa)}
        </span>
      </button>
    </li>
  );
}

function LencanaLive() {
  return (
    <span className="absolute left-2 top-2 flex h-6 items-center gap-1.5 rounded-md bg-[#ff4a1c] px-2 text-[11px] font-bold tracking-wide text-[#0c0e0d]">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-[#0c0e0d]" />
      LIVE
    </span>
  );
}

function IkonMata() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2"
         strokeLinecap="round" strokeLinejoin="round" className="size-3">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/**
 * Video siaran tanpa suara di kartu: hanya kamera pelapor yang dilanggan,
 * tersambung hanya selama `putar`. Selama belum ada gambar (menyambung, gagal,
 * siaran usai) videonya transparan dan avatar kartu yang tampil.
 */
function PratinjauLive({ ruang, putar }: { ruang: string; putar: boolean }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [tampil, setTampil] = useState(false);
  /** Menaikkan angka ini = mencoba lagi. */
  const [coba, setCoba] = useState(0);
  /** Server menolak tanpa harapan (siaran usai, bukan publik): tidak dicoba lagi. */
  const [ditolak, setDitolak] = useState(false);
  const gagal = useRef(0);

  useEffect(() => {
    if (!putar || ditolak || hematData()) return;
    let batal = false;
    let r: Room | null = null;
    const ulangi = () => {
      if (batal) return;
      tiketPratinjau.delete(ruang);
      gagal.current++;
      setCoba((n) => n + 1);
    };

    const id = setTimeout(async () => {
      const lk = await import("livekit-client").catch(() => null);
      if (!lk || batal) return;
      let tiket = tiketPratinjau.get(ruang);
      if (!tiket || tiket.sampai < Date.now()) {
        const h = await mintaTiket(ruang, true);
        if (batal) return;
        if (!h.ok) {
          if (h.ulang) ulangi();
          else setDitolak(true);
          return;
        }
        tiket = { ...h.tiket, sampai: Date.now() + UMUR_TIKET_MS };
        tiketPratinjau.set(ruang, tiket);
      }

      const { DisconnectReason, Room, RoomEvent, Track, VideoQuality } = lk;
      const ruangLk = new Room({ adaptiveStream: true });
      r = ruangLk;
      const langgan = (pub: RemoteTrackPublication, p: RemoteParticipant) => {
        if (pub.source !== Track.Source.Camera || !p.identity.startsWith(AWALAN_PELAPOR) || pub.isSubscribed) return;
        pub.setSubscribed(true);
        // Kartu ±180 px: lapisan 720p60 (±3 Mbps) yang mungkin ditarik
        // adaptiveStream di layar 2–3× tidak perlu.
        pub.setVideoQuality(VideoQuality.LOW);
      };
      ruangLk
        .on(RoomEvent.TrackPublished, langgan)
        .on(RoomEvent.TrackSubscribed, (track) => {
          if (track.kind === Track.Kind.Video && videoRef.current) track.attach(videoRef.current);
        })
        .on(RoomEvent.TrackUnsubscribed, (track) => {
          track.detach();
          setTampil(false);
        })
        .on(RoomEvent.Disconnected, (alasan) => {
          setTampil(false);
          if (alasan !== DisconnectReason.CLIENT_INITIATED) ulangi();
        });

      try {
        await ruangLk.connect(tiket.url, tiket.token, { autoSubscribe: false });
      } catch {
        ulangi();
        return;
      }
      if (batal) {
        ruangLk.disconnect();
        return;
      }
      gagal.current = 0;
      for (const p of ruangLk.remoteParticipants.values()) {
        for (const pub of p.trackPublications.values()) langgan(pub, p);
      }
    }, JEDA_ULANG_MS[Math.min(gagal.current, JEDA_ULANG_MS.length - 1)]);

    return () => {
      batal = true;
      clearTimeout(id);
      r?.disconnect();
      setTampil(false);
    };
  }, [ruang, putar, coba, ditolak]);

  return (
    <video
      ref={videoRef}
      muted
      playsInline
      autoPlay
      aria-hidden="true"
      onPlaying={() => setTampil(true)}
      className={`absolute inset-0 size-full object-cover transition-opacity duration-300 ${tampil ? "opacity-100" : "opacity-0"}`}
    />
  );
}

type Komentar = { id: number; nama: string; teks: string };
let urutKomentar = 0;

/**
 * Pemutar bersuara untuk penonton situs (tanpa akun = hanya menonton).
 * Komentar dari aplikasi tampil seperti di sana: 6 terakhir di kiri bawah,
 * kiriman ulang (atribut `id` yang sama) dan lebih dari 3 komentar per
 * pengirim per 10 dtk dibuang.
 */
function TontonLive({ siaran: s, bahasa, angka, onTutup }: {
  siaran: SiaranPublik;
  bahasa: Bahasa;
  angka: Intl.NumberFormat;
  onTutup: () => void;
}) {
  const t = TEKS[bahasa];
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const suaraRef = useRef<HTMLDivElement | null>(null);
  const tutupRef = useRef<HTMLButtonElement | null>(null);
  const ruangRef = useRef<Room | null>(null);
  const [status, setStatus] = useState<"menyambung" | "tayang" | "berakhir" | "gagal">("menyambung");
  const [menyambungUlang, setMenyambungUlang] = useState(false);
  const [bisaSuara, setBisaSuara] = useState(true);
  const [komentar, setKomentar] = useState<Komentar[]>([]);
  const [kini, setKini] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setKini(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const saatTombol = (e: KeyboardEvent) => {
      if (e.key === "Escape") onTutup();
    };
    window.addEventListener("keydown", saatTombol);
    const limpahan = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    tutupRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", saatTombol);
      document.body.style.overflow = limpahan;
    };
  }, [onTutup]);

  useEffect(() => {
    let batal = false;
    let r: Room | null = null;
    const wadahSuara = suaraRef.current;

    (async () => {
      const lk = await import("livekit-client").catch(() => null);
      if (batal) return;
      if (!lk) return setStatus("gagal");
      const h = await mintaTiket(s.ruang, false);
      if (batal) return;
      if (!h.ok) return setStatus(h.status === 404 ? "berakhir" : "gagal");

      const { DisconnectReason, Room, RoomEvent, Track } = lk;
      const ruangLk = new Room({ adaptiveStream: true, dynacast: true });
      r = ruangLk;
      ruangRef.current = ruangLk;

      const diterima = new Set<string>();
      const jejak = new Map<string, number[]>();
      ruangLk.registerTextStreamHandler(TOPIK_KOMENTAR, async (reader, { identity }) => {
        let isi: string;
        try {
          isi = (await reader.readAll()).trim().slice(0, BATAS_KOMENTAR);
        } catch {
          return; // pengirim putus di tengah kiriman
        }
        if (!isi || batal) return;
        const id = reader.info.attributes?.id;
        if (id) {
          if (diterima.has(id)) return;
          diterima.add(id);
          if (diterima.size > 500) diterima.delete(diterima.values().next().value!);
        }
        const sekarang = Date.now();
        const jendela = (jejak.get(identity) ?? []).filter((w) => sekarang - w < 10_000);
        if (jendela.length >= 3) return;
        jejak.set(identity, [...jendela, sekarang]);
        const nama = ruangLk.remoteParticipants.get(identity)?.name || "Warga";
        setKomentar((l) => [...l.slice(-5), { id: ++urutKomentar, nama, teks: isi }]);
      });

      ruangLk
        .on(RoomEvent.TrackSubscribed, (track, _pub, p) => {
          if (!p.identity.startsWith(AWALAN_PELAPOR)) return;
          if (track.kind === Track.Kind.Video) {
            if (videoRef.current) track.attach(videoRef.current);
          } else if (track.kind === Track.Kind.Audio) {
            const el = track.attach();
            el.hidden = true;
            wadahSuara?.append(el);
          }
        })
        .on(RoomEvent.TrackUnsubscribed, (track) => {
          track.detach().forEach((el) => el !== videoRef.current && el.remove());
        })
        .on(RoomEvent.ParticipantDisconnected, (p) => {
          if (p.identity.startsWith(AWALAN_PELAPOR)) setStatus("berakhir");
        })
        .on(RoomEvent.Reconnecting, () => setMenyambungUlang(true))
        .on(RoomEvent.Reconnected, () => setMenyambungUlang(false))
        .on(RoomEvent.AudioPlaybackStatusChanged, () => setBisaSuara(ruangLk.canPlaybackAudio))
        .on(RoomEvent.Disconnected, (alasan) => {
          if (batal) return;
          setMenyambungUlang(false);
          setStatus((st) => (st === "berakhir" || alasan === DisconnectReason.ROOM_DELETED ? "berakhir" : "gagal"));
        });

      try {
        await ruangLk.connect(h.tiket.url, h.tiket.token);
      } catch {
        if (!batal) setStatus("gagal");
        return;
      }
      if (batal) {
        ruangLk.disconnect();
        return;
      }
      if (![...ruangLk.remoteParticipants.values()].some((p) => p.identity.startsWith(AWALAN_PELAPOR))) {
        setStatus("berakhir");
      }
      // Klik kartu adalah gestur pengguna, jadi suara biasanya boleh langsung
      // diputar; bila peramban menolak, tombol "Nyalakan suara" muncul.
      ruangLk.startAudio().catch(() => {});
      setBisaSuara(ruangLk.canPlaybackAudio);
    })();

    return () => {
      batal = true;
      ruangRef.current = null;
      r?.disconnect();
      wadahSuara?.replaceChildren();
    };
  }, [s.ruang]);

  const pesan = status === "menyambung" || menyambungUlang
    ? t.liveMenyambung
    : status === "berakhir" ? t.liveBerakhir : status === "gagal" ? t.liveGagal : null;

  return (
    <div className="fixed inset-0 z-[80] flex cursor-pointer items-center justify-center bg-black/85 p-3 sm:p-6" onClick={onTutup}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${t.liveTonton}: ${s.judul}`}
        onClick={(e) => e.stopPropagation()}
        className="relative aspect-[9/16] h-full max-h-[min(92svh,900px)] max-w-full cursor-default overflow-hidden rounded-2xl bg-black text-white shadow-2xl"
      >
        <video
          ref={videoRef}
          muted
          playsInline
          autoPlay
          onPlaying={() => setStatus((st) => (st === "menyambung" ? "tayang" : st))}
          className="absolute inset-0 size-full object-contain"
        />
        <div ref={suaraRef} hidden />

        <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/75 to-transparent p-3 pb-10">
          <div className="flex items-center gap-2 pr-10">
            <span className="relative flex h-6 items-center gap-1.5 rounded-md bg-[#ff4a1c] px-2 text-[11px] font-bold tracking-wide text-[#0c0e0d]">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-[#0c0e0d]" />
              LIVE
            </span>
            <span className="flex h-6 items-center gap-1 rounded-md bg-black/55 px-1.5 text-[11px] font-semibold tabular-nums">
              <IkonMata />
              {angka.format(s.penonton)}
              <span className="sr-only"> {t.liveMenonton}</span>
            </span>
            <span className="text-[12px] font-medium tabular-nums text-white/80">{durasi(kini - s.mulai)}</span>
          </div>
          <p className="mt-2 text-[12px] font-semibold tracking-wide text-white/80 uppercase">{s.nama}</p>
          <h2 className="mt-0.5 line-clamp-2 text-[16px] leading-snug font-semibold text-pretty">{s.judul}</h2>
          <button
            ref={tutupRef}
            type="button"
            onClick={onTutup}
            aria-label={t.liveTutup}
            className="absolute right-2 top-2 flex size-9 cursor-pointer items-center justify-center rounded-full bg-black/45 transition-colors hover:bg-black/70 focus-visible:outline-2 focus-visible:outline-[#ff5a26]"
          >
            <IkonTutup className="size-4" />
          </button>
        </div>

        {pesan && (
          <p role="status" className="absolute inset-x-6 top-1/2 -translate-y-1/2 text-center text-[14px] font-medium text-white/90">
            {pesan}
          </p>
        )}

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-3 pt-12">
          {status === "tayang" && !bisaSuara && (
            <button
              type="button"
              onClick={() => void ruangRef.current?.startAudio().then(() => setBisaSuara(true)).catch(() => {})}
              className="mb-3 flex h-9 cursor-pointer items-center gap-2 rounded-full bg-white px-4 text-[13px] font-semibold text-tinta"
            >
              <IkonSuara className="size-4" />
              {t.liveSuara}
            </button>
          )}
          <ol aria-live="polite" className="flex max-w-[85%] flex-col items-start gap-1.5">
            {komentar.map((k) => (
              <li key={k.id} className="rounded-xl bg-black/45 px-2.5 py-1.5 text-[13px] leading-snug break-words">
                <span className="font-semibold text-white/75">{k.nama}</span> {k.teks}
              </li>
            ))}
          </ol>
          <p className="mt-2 text-[11px] text-white/60">{t.liveAplikasi}</p>
        </div>
      </div>
    </div>
  );
}
