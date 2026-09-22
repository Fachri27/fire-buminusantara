"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { BATAS_BERKAS, BATAS_TOTAL_BYTE } from "@/lib/batas-laporan";
import { TEKS_LAPOR, type Bahasa } from "@/lib/bahasa";
import { BilahUnggah } from "@/components/bilah-unggah";
import { Switch } from "@/components/ui/switch";
import { kirimLaporan, type KeadaanLapor } from "@/app/[locale]/lapor/aksi";

/**
 * Komposer lapor di konsol.
 *
 * Dua bagian, dan pembagiannya bukan selera:
 *
 * - Baris ajakan duduk di ruang sisa di atas bingkai peta (99px; sisa ruang
 *   terkecil 158px di 1280, jadi peta tak pernah bergeser).
 * - Formulir lengkapnya terbuka sebagai DIALOG, bukan melebar di tempat.
 *   Versi yang melebar sempat dicoba dan terukur menutupi enam kontrol peta
 *   di 1280 — kedua pil lapisan, Panduan Peta, kedua tombol zoom, dan tautan
 *   atribusi — sampai benar-benar tak bisa diklik. Melebar ke bawah berarti
 *   menindih peta; peta itu isi utama konsol, bukan latar.
 *
 * Memanggil server action yang sama dengan halaman /lapor: satu kontrak, satu
 * validasi. Aturan berkasnya cerminan tambahBerkas() di form itu — kalau
 * keduanya berbeda, komposer menerima berkas yang nanti ditolak server.
 */

/** Jenis berkas ditulis satu per satu, sama seperti form /lapor: dengan daftar
 *  eksplisit, iOS mengubah HEIC jadi JPEG lengkap dengan EXIF-nya. */
const DITERIMA = "image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm";

/* Turnstile. Server memeriksa captcha PALING DULU, sebelum satu berkas pun
   ditulis, dan ia hanya melewatinya bila TURNSTILE_SECRET_KEY kosong di
   lingkungan non-produksi. Komposer tanpa widget berarti token kosong, dan
   token kosong = "Verifikasi captcha gagal" di setiap kiriman. */
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

type TurnstileInstance = {
  render: (wadah: HTMLElement, opsi: Record<string, unknown>) => number;
  reset: (id: number) => void;
  remove: (id: number | null) => void;
};

function turnstile(): TurnstileInstance | null {
  return (window as Window & { turnstile?: TurnstileInstance }).turnstile ?? null;
}

/**
 * Penanda "baru saja berhasil mengirim", disimpan di lingkup MODUL.
 *
 * Bukan state komponen, karena komponennya sendiri yang dibuang: server action
 * memanggil revalidatePath("/[locale]") setelah sukses, rute index diambil
 * ulang, IsiHalaman yang async ter-suspend, dan seluruh pohon HalamanPeta
 * dipasang ulang bersama komposer ini. State useActionState ikut musnah,
 * sehingga "Laporan terkirim" cuma sempat terlihat beberapa detik.
 *
 * Modul tidak dievaluasi ulang saat remount, jadi penanda ini selamat.
 * Nilainya false di server maupun render pertama klien, jadi tak ada
 * ketidakcocokan hidrasi.
 *
 * Boolean, bukan stempel waktu: membandingkan Date.now() saat render adalah
 * pemanggilan fungsi tak murni, dan aturan React di repo ini menolaknya.
 * Hitungan mundurnya ditangani setTimeout di dalam effect, bukan dengan
 * membaca jam saat render.
 */
let suksesTertahan = false;

/** Konfirmasi menghilang sendiri setelah ini, tanpa perlu diklik. */
const JEDA_SUKSES = 5_000;

/** Dua berkas sama kalau nama, ukuran, dan waktu ubahnya sama. */
function kunciBerkas(b: File): string {
  return `${b.name}|${b.size}|${b.lastModified}`;
}

function ukuranTeks(byte: number): string {
  if (byte >= 1024 * 1024) return `${(byte / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(byte / 1024))} KB`;
}

/* Kata-kata khusus komposer. Sisanya memakai TEKS_LAPOR supaya kosakatanya
   sama persis dengan halaman /lapor — tombol yang di sana berbunyi "Kirim
   laporan" tidak boleh berbunyi lain di sini. */
const AJAKAN = {
  id: {
    ajak: "Lapor apa yang kamu lihat?",
    wajibFoto: "Sertakan foto atau video",
    judulDialog: "Tulis laporan",
    tutup: "Tutup",
    lagi: "Lapor lagi",
  },
  en: {
    ajak: "What are you seeing?",
    wajibFoto: "Attach a photo or video",
    judulDialog: "Write a report",
    tutup: "Close",
    lagi: "Report again",
  },
} as const;

export function KomposerLapor({ bahasa, asapAktif }: { bahasa: Bahasa; asapAktif: boolean }) {
  const teks = TEKS_LAPOR[bahasa];
  const ajakan = AJAKAN[bahasa];

  /* Aksen mengikuti lapisan peta yang sedang aktif, sama seperti pil filter
     dan tombol tutup/buka peta di halaman-peta.tsx (aksenFilter,
     aksenTombolPeta) — di situ sumber kebenarannya kalau warnanya berubah.
     Bedanya hanya nada TEKS: #49006a terlalu gelap untuk huruf di latar
     gelap, jadi ikon dan tautan memakai nada terang yang sama dengan cincin
     tombol peta. */
  const aksen = asapAktif
    ? {
        isi: "bg-[#49006a] hover:bg-[#5c0086]",
        teks: "text-fuchsia-300",
        sentuh: "hover:bg-fuchsia-500/15",
        tipis: "bg-fuchsia-500/15 ring-fuchsia-400/30",
        kotak: "accent-fuchsia-500",
      }
    : {
        isi: "bg-emerald-700 hover:bg-emerald-600",
        teks: "text-emerald-300",
        sentuh: "hover:bg-emerald-500/15",
        tipis: "bg-emerald-500/15 ring-emerald-400/30",
        kotak: "accent-emerald-500",
      };

  const [terbuka, setTerbuka] = useState(false);
  const [judul, setJudul] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [berkas, setBerkas] = useState<File[]>([]);
  const [pratinjau, setPratinjau] = useState<Record<string, string>>({});
  const [anonim, setAnonim] = useState(false);
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  /** "foto" = terisi dari GPS foto (pakai keterangan kecil); null = ketikan
   *  manual atau hasil "lokasi saya". */
  const [sumberLokasi, setSumberLokasi] = useState<"foto" | null>(null);
  const [mencariLokasi, setMencariLokasi] = useState(false);
  const [galatKlien, setGalatKlien] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  /* Nilai awal dibaca dari bendera modul supaya konfirmasi selamat dari
     remount akibat revalidatePath. Sesudah itu ia state biasa — dan justru
     itu yang penting: keadaan?.ok dari useActionState tidak bisa dibersihkan,
     jadi menurunkan tampilan darinya membuat baris terkunci selamanya di
     "Laporan terkirim" begitu sekali berhasil. */
  const [tampilSukses, setTampilSukses] = useState(suksesTertahan);

  const captchaRef = useRef<HTMLDivElement | null>(null);
  const widgetRef = useRef<number | null>(null);
  const berkasRef = useRef<HTMLInputElement | null>(null);
  /* Koordinat disimpan ganda di ref karena dibaca dari dalam callback async:
     pembacaan EXIF berjalan setelah beberapa await, dan nilai state yang
     tertangkap closure sudah basi saat itu. */
  const latRef = useRef("");
  const lngRef = useRef("");
  const lokasiAktifRef = useRef(true);
  const judulRef = useRef<HTMLInputElement | null>(null);
  const urlRef = useRef<string[]>([]);

  /* Berkas dipegang state React, jadi input DOM-nya disinkronkan lewat
     DataTransfer — inilah yang membuat berkasnya sampai ke server apa adanya,
     tanpa langkah baca-ulang yang menggugurkan EXIF. */
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
    sinkronkanKeInput(berkas);
  }, [berkas, sinkronkanKeInput]);

  useEffect(() => {
    const daftar = urlRef.current;
    return () => {
      for (const url of daftar) URL.revokeObjectURL(url);
    };
  }, []);

  useEffect(() => {
    latRef.current = lat;
    lngRef.current = lng;
  }, [lat, lng]);

  // Penjaga: callback geolokasi/EXIF yang datang terlambat tidak boleh
  // menyentuh komponen yang sudah lepas.
  useEffect(() => {
    lokasiAktifRef.current = true;
    return () => {
      lokasiAktifRef.current = false;
    };
  }, []);

  // Escape menutup dialog — pola yang sama dengan pop-up lain di konsol.
  useEffect(() => {
    if (!terbuka) return;
    const tekan = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTerbuka(false);
    };
    window.addEventListener("keydown", tekan);
    return () => window.removeEventListener("keydown", tekan);
  }, [terbuka]);

  /* Konfirmasi kembali ke ajakan sendiri setelah JEDA_SUKSES. Timer-nya di
     dalam effect, dan setState-nya terjadi di callback — bukan sinkron di
     badan effect, yang dilarang react-hooks/set-state-in-effect.

     Bendera modul ikut dimatikan: kalau hanya state-nya, remount berikutnya
     (revalidatePath sesudah kiriman) akan memunculkan konfirmasi itu lagi. */
  useEffect(() => {
    if (!tampilSukses) return;
    const jam = setTimeout(() => {
      suksesTertahan = false;
      setTampilSukses(false);
    }, JEDA_SUKSES);
    return () => clearTimeout(jam);
  }, [tampilSukses]);

  /* Token sekali pakai: kiriman yang gagal harus mengambil token baru, kalau
     tidak percobaan kedua memakai token yang sudah terpakai dan gagal lagi. */
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

  /* Widget dipasang saat dialog terbuka — wadahnya baru ada saat itu, beda
     dengan form /lapor yang wadahnya selalu ada di halaman. Mode explicit,
     appearance interaction-only: kotaknya hanya muncul kalau Cloudflare
     memang menantang. */
  useEffect(() => {
    if (!SITE_KEY || !terbuka) return;
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
        callback: (token: string) => setCaptchaToken(token),
        "expired-callback": () => setCaptchaToken(""),
        "error-callback": () => setCaptchaToken(""),
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
          /* sudah lepas bersama dialog yang ditutup */
        }
        widgetRef.current = null;
      }
    };
  }, [terbuka]);

  const [keadaan, aksi, mengirim] = useActionState<KeadaanLapor, FormData>(
    async (sebelumnya, data) => {
      const hasil = await kirimLaporan(sebelumnya, data);
      if (!hasil?.ok) ulangCaptcha();
      if (hasil?.ok) {
        suksesTertahan = true;
        setTampilSukses(true);
        for (const url of urlRef.current) URL.revokeObjectURL(url);
        urlRef.current = [];
        setPratinjau({});
        setBerkas([]);
        setJudul("");
        setDeskripsi("");
        setLat("");
        setLng("");
        setSumberLokasi(null);
        setTerbuka(false);
      }
      return hasil;
    },
    null,
  );

  /* keadaan?.ok saja tidak cukup: ia hilang bersama remount akibat
     revalidatePath. Penanda modul yang membuat konfirmasinya bertahan. */
  const berhasil = tampilSukses;
  const totalByte = berkas.reduce((n, b) => n + b.size, 0);
  const siapKirim = berkas.length > 0 && judul.trim() !== "" && deskripsi.trim() !== "";

  function tambahBerkas(dipilih: FileList | null) {
    if (!dipilih || dipilih.length === 0) return;
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
      setGalatKlien(teks.terlaluBanyak.replace("{n}", String(BATAS_BERKAS)));
      return;
    }
    if (gabungan.reduce((n, b) => n + b.size, 0) > BATAS_TOTAL_BYTE) {
      setGalatKlien(teks.terlaluBesar);
      return;
    }

    // URL pratinjau dibuat setelah validasi lolos, supaya berkas yang ditolak
    // tidak meninggalkan URL yang tertahan.
    const tambahan: Record<string, string> = {};
    for (const kunci of kunciBaru) {
      const b = gabungan.find((x) => kunciBerkas(x) === kunci);
      if (b) {
        const url = URL.createObjectURL(b);
        urlRef.current.push(url);
        tambahan[kunci] = url;
      }
    }
    if (Object.keys(tambahan).length > 0) setPratinjau((lama) => ({ ...lama, ...tambahan }));

    setBerkas(gabungan);
    sinkronkanKeInput(gabungan);
    if (berkasRef.current) berkasRef.current.value = "";

    // GPS foto mengisi koordinat yang masih kosong — tanpa menimpa ketikan
    // atau hasil "lokasi saya". Video dilewati di klien; server tetap mencoba.
    if (latRef.current.trim() === "" && lngRef.current.trim() === "") {
      void isiDariGpsFoto(gabungan);
    }
  }

  /** Baca GPS dari foto pertama yang punya; isi hanya bila masih kosong. */
  async function isiDariGpsFoto(daftar: File[]) {
    try {
      // Dinamis supaya exifr tidak ikut membebani bundel awal konsol.
      const { default: exifr } = await import("exifr");
      for (const b of daftar) {
        if (!b.type.startsWith("image/")) continue;
        const gps = (await exifr.gps(b).catch(() => null)) as {
          latitude?: unknown;
          longitude?: unknown;
        } | null;
        if (
          !gps || typeof gps.latitude !== "number" || typeof gps.longitude !== "number" ||
          !Number.isFinite(gps.latitude) || !Number.isFinite(gps.longitude)
        ) {
          continue;
        }
        if (!lokasiAktifRef.current) return;
        // Pelapor bisa mengetik manual selama pembacaan berlangsung — jangan
        // timpa isian yang sudah ada saat ini.
        if (latRef.current.trim() !== "" || lngRef.current.trim() !== "") return;
        // Tujuh desimal, sama seperti "lokasi saya" dan kolom DECIMAL(10,7).
        setLat(gps.latitude.toFixed(7));
        setLng(gps.longitude.toFixed(7));
        setSumberLokasi("foto");
        return;
      }
    } catch {
      /* tanpa GPS: biarkan kosong, server tetap mencoba saat menerima */
    }
  }

  function lokasiSaya() {
    if (!navigator.geolocation) {
      setGalatKlien(teks.lokasiGagal);
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
        setSumberLokasi(null);
      },
      () => {
        if (!lokasiAktifRef.current) return;
        setMencariLokasi(false);
        setGalatKlien(teks.lokasiGagal);
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  function buangBerkas(b: File) {
    const kunci = kunciBerkas(b);
    setBerkas((lama) => lama.filter((x) => kunciBerkas(x) !== kunci));
    setPratinjau((lama) => {
      const url = lama[kunci];
      if (url) URL.revokeObjectURL(url);
      const sisa = { ...lama };
      delete sisa[kunci];
      return sisa;
    });
  }

  function buka() {
    // Menulis laporan baru mengakhiri konfirmasi yang sedang tampil — bendera
    // modul DAN state-nya, karena keduanya saling menopang.
    suksesTertahan = false;
    setTampilSukses(false);
    setTerbuka(true);
    requestAnimationFrame(() => judulRef.current?.focus());
  }

  const galat = galatKlien || (keadaan && !keadaan.ok ? keadaan.galat : "");

  /* ── Baris ajakan: satu-satunya bagian yang menempati pita di atas peta ── */
  const baris = (
    <div className="mx-auto flex w-full max-w-[720px] items-center gap-3 rounded-2xl bg-pantau-konsol
                    px-4 py-3 ring-1 ring-white/10 [zoom:var(--skala-rel)]">
      {/* Logo yang sama dengan bilah navigasi. Rasionya tinggi (99x160), jadi
          tingginya yang dipatok dan lebarnya mengikuti — dipaksa masuk
          lingkaran, ia akan terpencet. */}
      <Image
        src="/assets/img/logo-fire.png"
        alt=""
        aria-hidden="true"
        width={99}
        height={160}
        className="h-7 w-auto shrink-0"
      />

      {berhasil ? (
        <>
          <p className="min-w-0 flex-1 truncate text-[14px] text-pantau-tulang">{teks.berhasilJudul}</p>
          <button
            type="button"
            onClick={buka}
            className="cursor-pointer shrink-0 rounded-full bg-white/10 px-3.5 py-1.5 text-[12.5px] font-semibold
                       text-pantau-tulang transition hover:bg-white/15
                       focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {ajakan.lagi}
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={buka}
            className="cursor-pointer min-w-0 flex-1 truncate py-1 text-left text-[15px] text-pantau-abu transition
                       hover:text-pantau-tulang focus-visible:outline-2 focus-visible:outline-offset-2
                       focus-visible:outline-white"
          >
            {ajakan.ajak}
          </button>
          <button
            type="button"
            onClick={buka}
            className={`cursor-pointer shrink-0 rounded-full px-4 py-1.5 text-[13px] font-semibold text-white ring-1
                        ring-white/15 transition ${aksen.isi}
                        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white`}
          >
            {teks.kirim}
          </button>
        </>
      )}
    </div>
  );

  /* ── Dialog: formulir lengkap, lepas dari tata letak peta ──
     Skalanya dipasang sendiri di form-nya, terpisah dari baris ajakan: dialog
     ini di-portal ke document.body, jadi ia berada di luar jangkauan
     pembungkus mana pun di kolom tengah. Tanpa itu, di zoom 125% barisnya ikut
     mengecil sementara dialognya tetap 25% lebih besar. */
  const dialog = (
    <div
      className="cursor-pointer fixed inset-0 z-[80] grid place-items-start justify-center overflow-y-auto
                 bg-black/70 px-4 py-[8vh] backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setTerbuka(false);
      }}
    >
      <form
        action={aksi}
        role="dialog"
        aria-modal="true"
        aria-label={ajakan.judulDialog}
        className="cursor-default w-full max-w-[560px] rounded-2xl bg-pantau-konsol p-5 ring-1 ring-white/15
                   shadow-[0_24px_80px_rgb(0_0_0/0.6)] [zoom:var(--skala-rel)]"
      >
        {/* Kepala: logo + judul yang TERLIHAT. Sebelumnya dialog ini hanya
            punya aria-label, jadi pemakai awas tak melihat penanda apa pun. */}
        <div className="mb-3 flex items-center gap-2.5 border-b border-white/10 pb-2.5">
          <Image
            src="/assets/img/logo-fire.png"
            alt=""
            aria-hidden="true"
            width={99}
            height={160}
            className="h-7 w-auto shrink-0"
          />
          <h2 className="text-[13.5px] font-semibold tracking-tight text-pantau-tulang">
            {ajakan.judulDialog}
          </h2>
        </div>

        <div>
          <div className="min-w-0">
            <input
              ref={judulRef}
              name="judul"
              required
              maxLength={255}
              value={judul}
              onChange={(e) => setJudul(e.target.value)}
              placeholder={teks.labelJudul}
              autoComplete="off"
              className="w-full bg-transparent text-[16px] font-semibold text-pantau-tulang
                         placeholder:text-pantau-abu/70 focus:outline-none"
            />
            <textarea
              name="deskripsi"
              required
              maxLength={5000}
              rows={2}
              value={deskripsi}
              onChange={(e) => {
                setDeskripsi(e.target.value);
                /* Tumbuh mengikuti isi, bukan dipatok empat baris. Dengan rows
                   tetap, kotak yang baru berisi placeholder menyisakan rongga
                   menganga di atas baris koordinat — dan rongga itulah yang
                   pertama menarik mata, bukan isinya. Atapnya 220px supaya
                   cerita panjang tidak mendorong dialog melewati layar. */
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
              }}
              placeholder={teks.petunjukDeskripsi}
              className="mt-2 w-full resize-none bg-transparent text-[14px] leading-[1.6] text-pantau-tulang
                         placeholder:text-pantau-abu/70 focus:outline-none"
            />
          </div>
        </div>

        {berkas.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {berkas.map((b) => {
              const kunci = kunciBerkas(b);
              const url = pratinjau[kunci];
              return (
                <li key={kunci} className="relative">
                  {url && b.type.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt="" className="size-16 rounded-lg object-cover ring-1 ring-white/15" />
                  ) : (
                    <span className="grid size-16 place-items-center rounded-lg bg-black/40 text-[10px]
                                     text-pantau-abu ring-1 ring-white/15">
                      video
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => buangBerkas(b)}
                    aria-label={`${teks.hapusBerkas} ${b.name}`}
                    className="cursor-pointer absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full
                               bg-black/80 text-[11px] text-white ring-1 ring-white/25 transition
                               hover:bg-black focus-visible:outline-2 focus-visible:outline-white"
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {galat && (
          <p role="alert" className="mt-3 text-[12.5px] leading-relaxed text-pantau-bara">
            {galat}
          </p>
        )}

        {/* Koordinat: opsional di server, tapi laporan tanpa titik tak bisa
            ditempatkan di peta — dan peta itu seluruh gunanya konsol ini. */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            name="lat"
            inputMode="decimal"
            value={lat}
            onChange={(e) => {
              setLat(e.target.value);
              setSumberLokasi(null);
            }}
            placeholder={teks.lat}
            aria-label={teks.lat}
            className="w-[136px] rounded-lg bg-black/40 px-2.5 py-1.5 font-mono text-[12px] text-pantau-tulang
                       ring-1 ring-white/10 placeholder:text-pantau-abu/60
                       focus:ring-white/25 focus:outline-none"
          />
          <input
            name="lng"
            inputMode="decimal"
            value={lng}
            onChange={(e) => {
              setLng(e.target.value);
              setSumberLokasi(null);
            }}
            placeholder={teks.lng}
            aria-label={teks.lng}
            className="w-[136px] rounded-lg bg-black/40 px-2.5 py-1.5 font-mono text-[12px] text-pantau-tulang
                       ring-1 ring-white/10 placeholder:text-pantau-abu/60
                       focus:ring-white/25 focus:outline-none"
          />
          <button
            type="button"
            onClick={lokasiSaya}
            disabled={mencariLokasi}
            className={`cursor-pointer disabled:cursor-not-allowed rounded-full px-3 py-1.5 text-[12.5px] transition disabled:opacity-50
                        ${aksen.teks} ${aksen.sentuh}
                        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white`}
          >
            {mencariLokasi ? teks.mencariLokasi : teks.pakaiLokasi}
          </button>
        </div>

        {sumberLokasi === "foto" && (
          <p className="mt-1.5 text-[11.5px] text-pantau-abu/80">{teks.lokasiDariFoto}</p>
        )}

        <p className="mt-3 text-[11.5px] leading-relaxed text-pantau-abu/80">{teks.catatanMetadata}</p>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
          <input
            ref={berkasRef}
            type="file"
            name="berkas"
            multiple
            accept={DITERIMA}
            onChange={(e) => tambahBerkas(e.target.files)}
            className="sr-only"
            id="komposer-berkas"
          />
          <label
            htmlFor="komposer-berkas"
            className={`flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12.5px]
                        transition ${aksen.teks} ${aksen.sentuh}`}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8"
                 strokeLinecap="round" strokeLinejoin="round" className="size-[18px]">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <circle cx="8.5" cy="9.5" r="1.5" />
              <path d="m21 16-5-5L5 20" />
            </svg>
            {/* Syarat wajibnya jadi label tombolnya sendiri, bukan tulisan
                terpisah di sebelahnya — satu benda lebih sedikit di baris yang
                tadinya berisi lima. */}
            {berkas.length > 0
              ? `${berkas.length}/${BATAS_BERKAS} · ${ukuranTeks(totalByte)}`
              : ajakan.wajibFoto}
          </label>

          <label className="flex cursor-pointer items-center gap-2 rounded-full px-2.5 py-1.5 text-[12.5px]
                            text-pantau-abu transition hover:bg-white/5">
            <Switch
              name="anonim"
              value="1"
              checked={anonim}
              onCheckedChange={setAnonim}
              size="sm"
              aksen={asapAktif ? "fuchsia" : "emerald"}
            />
            <span>{teks.anonim}</span>
          </label>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTerbuka(false)}
              className="cursor-pointer rounded-full px-3 py-1.5 text-[12.5px] text-pantau-abu transition hover:text-pantau-tulang
                         focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              {ajakan.tutup}
            </button>
            <button
              type="submit"
              disabled={!siapKirim || mengirim}
              aria-busy={mengirim}
              className={`cursor-pointer disabled:cursor-not-allowed rounded-full px-4 py-1.5 text-[13px] font-semibold text-white ring-1 ring-white/15
                          transition disabled:opacity-40 ${aksen.isi}
                          focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white`}
            >
              {mengirim ? teks.mengirim : teks.kirim}
            </button>
          </div>
        </div>

        {mengirim && (
          <div className={`mt-3 ${aksen.teks}`}>
            <BilahUnggah />
          </div>
        )}

        {/* Wadah widget Turnstile + token terverifikasi. Tanpa keduanya server
            menolak setiap kiriman di gerbang captcha. */}
        <div ref={captchaRef} className="mt-2 empty:hidden" />
        <input type="hidden" name="captcha" value={captchaToken} />

        {/* Umpan jebakan: hanya bot yang mengisinya. */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      </form>
    </div>
  );

  return (
    <>
      {baris}
      {/* Tanpa gerbang "sudah terpasang": portal hanya disentuh saat `terbuka`,
          dan itu hanya bisa menyala lewat klik — mustahil di render server,
          jadi document tak pernah dibaca di sana. */}
      {terbuka ? createPortal(dialog, document.body) : null}
    </>
  );
}
