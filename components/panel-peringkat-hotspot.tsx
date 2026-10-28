"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  peringkatHotspot,
  SATELIT_HOTSPOT,
  SATELIT_PERINGKAT,
  WARNA_SIPONGI,
  type BarisPeringkat,
  type DataHotspot,
} from "@/lib/lapisan-hotspot";
import { nomorHalaman } from "@/lib/halaman";
import type { Bahasa } from "@/lib/bahasa";

/** Semua tulisan panel per bahasa (pola TEKS landing-karhutla/teks.ts).
 *  Yang memuat bilangan berupa fungsi: bentuk jamak Inggris ikut jumlahnya.
 *  Indeks kepercayaan sama dengan data: 0 rendah, 1 sedang, 2 tinggi. */
const TEKS = {
  id: {
    lokalAngka: "id-ID",
    lokalTanggal: "id-ID",
    judul: "Peringkat Hotspot",
    ciutkan: "Ciutkan",
    ciutkanPanel: "Ciutkan peringkat hotspot",
    bukaPanel: "Buka peringkat hotspot",
    kembaliPeta: "Peta",
    jam24: "24 jam terakhir",
    dataSampai: (waktu: string) => `Data sampai ${waktu}.`,
    provinsi: "Provinsi",
    kabupaten: "Kabupaten/Kota",
    wilayah: (n: number) => `${n} wilayah`,
    unduh: "Unduh CSV",
    unduhDaftar: (judul: string) => `Unduh CSV ${judul}`,
    lihatRincian: (angka: string) => `${angka} deteksi, lihat rincian`,
    kosong: "Tidak ada deteksi pada hari ini.",
    pager: (judul: string) => `Halaman ${judul}`,
    sebelumnya: "Halaman sebelumnya",
    berikutnya: "Halaman berikutnya",
    halaman: (h: number, a: number, b: number) => `Halaman ${h}, peringkat ${a}–${b}`,
    deteksi: () => "deteksi",
    diProvinsi: (n: number) => `di ${n} provinsi`,
    kepercayaan: ["Rendah", "Sedang", "Tinggi"],
    kepercayaanPenuh: ["Kepercayaan rendah", "Kepercayaan sedang", "Kepercayaan tinggi"],
    siang: "Siang",
    malam: "Malam",
    galat: "NASA FIRMS tak terjangkau. Peta mencoba lagi tiap menit.",
    memuat: "Memuat data hotspot…",
    catatan: "Hari mengikuti bilah waktu peta. Arahkan kursor atau ketuk angka untuk rinciannya.",
    kepalaCsv: (satelit: string[]) => ["peringkat", "nama", "jumlah", ...satelit, "rendah", "sedang", "tinggi", "malam"],
  },
  en: {
    lokalAngka: "en-US",
    lokalTanggal: "en-GB",
    judul: "Hotspot ranking",
    ciutkan: "Collapse",
    ciutkanPanel: "Collapse hotspot ranking",
    bukaPanel: "Expand hotspot ranking",
    kembaliPeta: "Map",
    jam24: "Last 24 hours",
    dataSampai: (waktu: string) => `Data up to ${waktu}.`,
    provinsi: "Provinces",
    kabupaten: "Regencies/Cities",
    wilayah: (n: number) => `${n} ${n === 1 ? "region" : "regions"}`,
    unduh: "Download CSV",
    unduhDaftar: (judul: string) => `Download ${judul} CSV`,
    lihatRincian: (angka: string, n: number) => `${angka} ${n === 1 ? "detection" : "detections"}, view details`,
    kosong: "No detections on this day.",
    pager: (judul: string) => `Pages: ${judul}`,
    sebelumnya: "Previous page",
    berikutnya: "Next page",
    halaman: (h: number, a: number, b: number) => `Page ${h}, ranks ${a}–${b}`,
    deteksi: (n: number) => (n === 1 ? "detection" : "detections"),
    diProvinsi: (n: number) => `in ${n} ${n === 1 ? "province" : "provinces"}`,
    kepercayaan: ["Low", "Medium", "High"],
    kepercayaanPenuh: ["Low confidence", "Medium confidence", "High confidence"],
    siang: "Day",
    malam: "Night",
    galat: "NASA FIRMS is unreachable. The map retries every minute.",
    memuat: "Loading hotspot data…",
    catatan: "The day follows the map's time slider. Hover over or tap a number to see its breakdown.",
    kepalaCsv: (satelit: string[]) => ["rank", "name", "total", ...satelit, "low", "medium", "high", "night"],
  },
};
type Teks = (typeof TEKS)[Bahasa];

/** Tinggi tetap satu baris + selanya, px — dasar baris per halaman. */
const TINGGI_BARIS = 30;
/** "NASA-SNPP" → "SNPP". */
const NAMA_SATELIT = SATELIT_PERINGKAT.map((s) => SATELIT_HOTSPOT[s].label.replace("NASA-", ""));
const angka = (n: number, t: Teks) => n.toLocaleString(t.lokalAngka);
/** "2026-10-27" → "Selasa, 27 Oktober 2026" / "Tuesday, 27 October 2026". */
const hariPanjang = (hari: string, t: Teks) =>
  new Date(`${hari}T00:00:00Z`).toLocaleDateString(t.lokalTanggal, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
/** Waktu pembaruan data dalam WIB, mis. "27 Okt, 14.30 WIB" / "27 Oct, 14:30 WIB". */
const waktuWib = (ms: number, t: Teks) =>
  `${new Date(ms).toLocaleString(t.lokalTanggal, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Jakarta" })} WIB`;

/** Kartu rincian jumlah — fixed di body (pola tooltip provinsi peta-asap.tsx):
 *  bingkai peta landing memakai transform. `hari`: bilah waktu berputar
 *  mengganti hari (dan urutan baris) di bawah kursor — kartu hari lama
 *  ditutup, bukan dibiarkan menunjuk baris yang sudah pindah. */
type Rincian = { baris: BarisPeringkat; hari: string; x: number; y: number; kiri: boolean };

function unduhCsv(baris: BarisPeringkat[], berkas: string, t: Teks) {
  const kepala = t.kepalaCsv(NAMA_SATELIT.map((n) => n.toLowerCase()));
  const isi = baris.map((b, i) =>
    [i + 1, `"${b.nama.replace(/"/g, '""')}"`, b.jumlah, ...b.perSatelit, ...b.perKepercayaan, b.malam].join(","),
  );
  const url = URL.createObjectURL(new Blob([[kepala.join(","), ...isi].join("\n")], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = berkas;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url));
}

/** Tombol pager: kotak bersudut lembut; panah tanpa latar, nomor berlatar,
 *  halaman aktif berwarna api-peta — merah yang sama dengan isi batang. */
const kelasPager = "flex h-[26px] min-w-[26px] shrink-0 items-center justify-center rounded-md px-1 text-[12px] font-semibold tabular-nums transition-colors";
const kelasPanah = `${kelasPager} cursor-pointer text-tinta/50 hover:bg-black/[0.05] hover:text-tinta disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent dark:text-white/50 dark:hover:bg-white/[0.08] dark:hover:text-white`;
const kelasNomor = `${kelasPager} cursor-pointer border border-transparent bg-black/[0.04] text-tinta/60 hover:bg-black/[0.08] hover:text-tinta dark:bg-white/[0.06] dark:text-white/60 dark:hover:bg-white/[0.1] dark:hover:text-white`;
const kelasNomorAktif = `${kelasPager} border border-api-peta bg-api-peta/10 text-api-peta dark:bg-api-peta/30 dark:text-white`;

/**
 * Satu daftar peringkat sebagai diagram batang: isi merah di belakang tiap
 * baris sepanjang jumlahnya terhadap peringkat pertama. Tanpa gulir — banyak
 * baris per halaman dihitung dari tinggi daftar (ResizeObserver, ukuran logis:
 * aman di bingkai landing yang diperkecil); halaman lain lewat pager bernomor.
 */
function DaftarPeringkat({
  judul,
  baris,
  berkas,
  onRincian,
  t,
}: {
  judul: string;
  baris: BarisPeringkat[];
  berkas: string;
  onRincian: (b: BarisPeringkat | null, el?: HTMLElement) => void;
  t: Teks;
}) {
  const daftarRef = useRef<HTMLOListElement>(null);
  const [perHalaman, setPerHalaman] = useState(5);
  const [halaman, setHalaman] = useState(0);
  useEffect(() => {
    const el = daftarRef.current;
    if (!el) return;
    const pengamat = new ResizeObserver(([e]) => setPerHalaman(Math.max(1, Math.floor(e.contentRect.height / TINGGI_BARIS))));
    pengamat.observe(el);
    return () => pengamat.disconnect();
  }, []);
  const jumlahHalaman = Math.max(1, Math.ceil(baris.length / perHalaman));
  // Hari berganti (bilah waktu) bisa memendekkan daftar: jepit halamannya
  // sungguhan, supaya tak melompat balik saat daftar memanjang lagi.
  if (halaman > jumlahHalaman - 1) setHalaman(jumlahHalaman - 1);
  const kini = Math.min(halaman, jumlahHalaman - 1);
  const awal = kini * perHalaman;
  const akhir = Math.min(awal + perHalaman, baris.length);
  const teratas = baris[0]?.jumlah ?? 1;
  const pindah = (h: number) => {
    onRincian(null);
    setHalaman(h);
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-baseline gap-2 px-1">
        <h3 className="text-[13px] font-semibold">{judul}</h3>
        <span className="text-[11px] text-tinta/50 dark:text-white/45">{t.wilayah(baris.length)}</span>
        <button
          type="button"
          onClick={() => unduhCsv(baris, berkas, t)}
          disabled={!baris.length}
          title={t.unduh}
          aria-label={t.unduhDaftar(judul)}
          className="ml-auto cursor-pointer self-center rounded-md p-1 text-tinta/50 transition-colors hover:bg-black/[0.05] hover:text-tinta disabled:cursor-default disabled:opacity-40 dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white"
        >
          <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 4v11m-4.5-4.5L12 15l4.5-4.5M4 15v4h16v-4" />
          </svg>
        </button>
      </div>
      <ol ref={daftarRef} start={awal + 1} className="mt-1.5 min-h-0 flex-1 overflow-hidden">
        {baris.length ? (
          baris.slice(awal, akhir).map((b, i) => (
            <li key={b.nama} style={{ height: TINGGI_BARIS - 2 }} className="relative mb-0.5 flex items-center gap-2 overflow-hidden rounded-md pl-2 pr-1">
              {/* Isi batang — baris dikunci nama, jadi saat hari berganti
                  lebarnya meluncur dari nilai lama ke nilai baru. */}
              <span
                aria-hidden="true"
                className="absolute inset-y-0 left-0 rounded-md bg-api-peta/[0.16] transition-[width] duration-500 ease-out motion-reduce:transition-none dark:bg-api-peta/[0.38]"
                style={{ width: `${Math.max(1.5, (b.jumlah / teratas) * 100)}%` }}
              />
              <span className="relative w-5 shrink-0 text-right text-[11px] tabular-nums text-tinta/45 dark:text-white/45">{awal + i + 1}</span>
              <span className="relative min-w-0 flex-1 truncate text-[12.5px] font-medium">{b.nama}</span>
              {/* Tombol, bukan teks: rinciannya juga terbuka lewat fokus papan
                  ketik dan ketukan layar sentuh. */}
              <button
                type="button"
                onMouseEnter={(e) => onRincian(b, e.currentTarget)}
                onFocus={(e) => onRincian(b, e.currentTarget)}
                onClick={(e) => onRincian(b, e.currentTarget)}
                onMouseLeave={() => onRincian(null)}
                onBlur={() => onRincian(null)}
                aria-label={t.lihatRincian(angka(b.jumlah, t), b.jumlah)}
                className="relative shrink-0 cursor-help rounded px-1 py-0.5 text-[12.5px] font-semibold tabular-nums underline decoration-tinta/30 decoration-dotted underline-offset-[3px] transition-colors hover:bg-white/70 dark:decoration-white/30 dark:hover:bg-white/10"
              >
                {angka(b.jumlah, t)}
              </button>
            </li>
          ))
        ) : (
          <li className="px-1 py-2 text-[12px] text-tinta/55 dark:text-white/55">{t.kosong}</li>
        )}
      </ol>
      {jumlahHalaman > 1 && (
        <nav aria-label={t.pager(judul)} className="flex shrink-0 items-center justify-between gap-1 pt-2">
          <button type="button" onClick={() => pindah(kini - 1)} disabled={kini === 0} aria-label={t.sebelumnya} className={kelasPanah}>
            <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <span className="flex items-center gap-1">
          {nomorHalaman(kini, jumlahHalaman).map((h, i) =>
            h === null ? (
              <span key={`elipsis-${i}`} className="w-4 text-center text-[12px] text-tinta/40 dark:text-white/40" aria-hidden="true">
                …
              </span>
            ) : (
              <button
                key={h}
                type="button"
                onClick={() => pindah(h)}
                aria-label={t.halaman(h + 1, h * perHalaman + 1, Math.min((h + 1) * perHalaman, baris.length))}
                aria-current={h === kini ? "page" : undefined}
                className={h === kini ? kelasNomorAktif : kelasNomor}
              >
                {h + 1}
              </button>
            ),
          )}
          </span>
          <button type="button" onClick={() => pindah(kini + 1)} disabled={kini >= jumlahHalaman - 1} aria-label={t.berikutnya} className={kelasPanah}>
            <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </nav>
      )}
    </section>
  );
}

/** Pola tooltip gelap peta (#asap-provinsi-tooltip, kartuHotspot). */
function KartuRincian({ rincian: { baris: b, x, y, kiri }, t }: { rincian: Rincian; t: Teks }) {
  return createPortal(
    <div
      role="tooltip"
      style={{ left: x, top: y, transform: `translate(${kiri ? "-100%" : "0"}, -50%)` }}
      className="pointer-events-none fixed z-[1200] w-52 rounded-lg border border-white/25 bg-[rgba(20,16,15,0.94)] px-3 py-2 text-[11px] font-medium leading-snug text-white shadow-[0_4px_16px_rgba(0,0,0,0.6)]"
    >
      <div className="font-bold text-[#f59e0b]">{b.nama}</div>
      <div className="mt-0.5 tabular-nums">
        {b.perSatelit.map((n, j) => `${NAMA_SATELIT[j]} ${angka(n, t)}`).join(" + ")} = <strong>{angka(b.jumlah, t)}</strong>
      </div>
      <div className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-px border-t border-white/15 pt-1.5 tabular-nums">
        {([2, 1, 0] as const).map((k) => (
          <div key={k} className="contents">
            <span className="flex items-center gap-1.5 text-white/60">
              <span className="h-2 w-2 rounded-full" style={{ background: WARNA_SIPONGI[k] }} aria-hidden="true" />
              {t.kepercayaanPenuh[k]}
            </span>
            <span className="text-right">{angka(b.perKepercayaan[k], t)}</span>
          </div>
        ))}
        <span className="mt-1 text-white/60">{t.siang}</span>
        <span className="mt-1 text-right">{angka(b.jumlah - b.malam, t)}</span>
        <span className="text-white/60">{t.malam}</span>
        <span className="text-right">{angka(b.malam, t)}</span>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Ringkasan hari: total deteksi ketiga satelit, pita bertumpuk per tingkat
 * kepercayaan (warna penanda peta), lalu per satelit dan siang/malam. Dijumlah
 * dari baris provinsi — tiap titik pasti berprovinsi, jadi totalnya sama
 * dengan jumlah kedua tabel.
 */
function RingkasanHari({ provinsi, t }: { provinsi: BarisPeringkat[]; t: Teks }) {
  const total = provinsi.reduce(
    (t, b) => ({
      jumlah: t.jumlah + b.jumlah,
      perSatelit: t.perSatelit.map((n, j) => n + b.perSatelit[j]),
      perKepercayaan: t.perKepercayaan.map((n, k) => n + b.perKepercayaan[k]),
      malam: t.malam + b.malam,
    }),
    { jumlah: 0, perSatelit: SATELIT_PERINGKAT.map(() => 0), perKepercayaan: [0, 0, 0], malam: 0 },
  );
  const urutKepercayaan = [2, 1, 0] as const;
  return (
    <div className="shrink-0 border-b border-black/10 px-4 py-3 motion-safe:animate-[hari-masuk_350ms_ease-out] dark:border-white/10">
      <p className="flex items-baseline gap-1.5">
        <span className="text-[22px] font-semibold leading-none tabular-nums">{angka(total.jumlah, t)}</span>
        <span className="text-[12px] text-tinta/60 dark:text-white/55">{t.deteksi(total.jumlah)}</span>
        <span className="ml-auto text-[11px] text-tinta/55 dark:text-white/50">{t.diProvinsi(provinsi.length)}</span>
      </p>
      {total.jumlah > 0 && (
        <>
          <div className="mt-2.5 flex h-1.5 gap-px overflow-hidden rounded-full" aria-hidden="true">
            {urutKepercayaan.map((k) =>
              total.perKepercayaan[k] ? (
                <span key={k} style={{ width: `${(total.perKepercayaan[k] / total.jumlah) * 100}%`, background: WARNA_SIPONGI[k] }} />
              ) : null,
            )}
          </div>
          {/* Layar pendek (≤ 760px): legenda & strip angka disembunyikan supaya
              tiap daftar tetap memuat beberapa baris; rinciannya ada di kartu angka. */}
          <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-tinta/65 dark:text-white/60 [@media(max-height:760px)]:hidden">
            {urutKepercayaan.map((k) => (
              <span key={k} className="flex items-center gap-1 tabular-nums">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: WARNA_SIPONGI[k] }} aria-hidden="true" />
                {t.kepercayaan[k]} <span className="font-semibold text-tinta dark:text-white">{angka(total.perKepercayaan[k], t)}</span>
              </span>
            ))}
          </p>
          {/* Kisi 6 kolom: baris atas tiga satelit (2 kolom), baris bawah siang & malam (3 kolom) —
              "TERRA/AQUA" tak muat bila kelimanya sebaris di kolom 300px. */}
          <dl className="mt-2.5 grid grid-cols-6 gap-1 text-center [@media(max-height:760px)]:hidden">
            {[
              ...NAMA_SATELIT.map((nama, j) => [nama, total.perSatelit[j], "col-span-2"] as const),
              [t.siang, total.jumlah - total.malam, "col-span-3"] as const,
              [t.malam, total.malam, "col-span-3"] as const,
            ].map(([label, n, lebar]) => (
              // dt lebih dulu (urutan sah <dl>), angka tampil di atas lewat flex-col-reverse.
              <div key={label} className={`${lebar} flex flex-col-reverse rounded-md bg-black/[0.04] py-1 dark:bg-white/[0.06]`}>
                <dt className="text-[10px] text-tinta/55 dark:text-white/50">{label}</dt>
                <dd className="text-[12.5px] font-semibold tabular-nums">{angka(n, t)}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </div>
  );
}

/**
 * Peringkat provinsi & kabupaten/kota menurut hotspot MODIS + S-NPP + NOAA-20
 * pada hari yang tampil di peta (ikut bilah waktu). Kolom samping peta.tsx;
 * kedua daftar berbagi tinggi kolom, tanpa gulir.
 */
export function PanelPeringkatHotspot({
  data,
  status,
  onTutup,
  bahasa,
}: {
  data: DataHotspot | null;
  status: "diam" | "memuat" | "siap" | "galat";
  onTutup: () => void;
  bahasa: Bahasa;
}) {
  const t = TEKS[bahasa];
  const peringkat = useMemo(() => (data ? peringkatHotspot(data) : null), [data]);
  const [rincian, setRincian] = useState<Rincian | null>(null);
  const tampilRincian = (b: BarisPeringkat | null, el?: HTMLElement) => {
    if (!b || !el || !data) return setRincian(null);
    const r = el.getBoundingClientRect();
    // Kanan angka bila muat (kolom samping), kiri bila tidak (lembar ponsel).
    const kiri = r.right + 8 + 208 > window.innerWidth;
    setRincian({ baris: b, hari: data.hari, x: kiri ? r.left - 8 : r.right + 8, y: r.top + r.height / 2, kiri });
  };

  return (
    <div className="flex h-full w-full flex-col bg-white text-tinta dark:bg-pantau-konsol dark:text-white">
      {/* pr-14 di ponsel: tombol tutup selayar landing menempati sudut kanan atas. */}
      <div className="flex shrink-0 items-start gap-2 border-b border-black/10 py-3 pl-4 pr-14 lg:pr-3 dark:border-white/10">
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={onTutup}
            className="-ml-1 mb-1.5 flex cursor-pointer items-center gap-0.5 rounded-md px-1 py-0.5 text-[12px] font-semibold text-api-peta transition-colors hover:bg-api-peta/10 lg:hidden"
          >
            <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m15 18-6-6 6-6" />
            </svg>
            {t.kembaliPeta}
          </button>
          <h2 className="text-sm font-semibold">{t.judul}</h2>
          {/* key = hari: tanggal baru masuk dengan animasi tiap hari berganti.
              Hari terbaru (`sejak`) = 24 jam terakhir, bukan hari kalender. */}
          {data && (
            <p key={data.hari} className="mt-1 text-[13px] font-medium motion-safe:animate-[hari-masuk_350ms_ease-out]">
              {data.sejak ? t.jam24 : hariPanjang(data.hari, t)}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onTutup}
          aria-label={t.ciutkanPanel}
          title={t.ciutkan}
          className="hidden cursor-pointer rounded-md p-1.5 text-tinta/60 lg:block transition-colors hover:bg-black/[0.05] hover:text-tinta dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white"
        >
          <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path d="M9 3v18m7-6-3-3 3-3" />
          </svg>
        </button>
      </div>
      {peringkat && data && <RingkasanHari key={data.hari} provinsi={peringkat.provinsi} t={t} />}
      {peringkat && data ? (
        <div className="flex min-h-0 flex-1 flex-col gap-4 px-3 py-3">
          <DaftarPeringkat judul={t.provinsi} baris={peringkat.provinsi} berkas={`hotspot-provinsi-${data.hari}.csv`} onRincian={tampilRincian} t={t} />
          <DaftarPeringkat judul={t.kabupaten} baris={peringkat.kabupaten} berkas={`hotspot-kabupaten-${data.hari}.csv`} onRincian={tampilRincian} t={t} />
        </div>
      ) : (
        <p className="flex-1 px-4 py-3 text-[12px] text-tinta/55 dark:text-white/50">{status === "galat" ? t.galat : t.memuat}</p>
      )}
      <p className="shrink-0 border-t border-black/10 px-4 py-2 text-[10.5px] leading-snug text-tinta/50 dark:border-white/10 dark:text-white/45">
        {data?.diperbarui && <span className="block">{t.dataSampai(waktuWib(Date.parse(data.diperbarui), t))}</span>}
        {/* Layar pendek: cukup baris "data sampai" supaya daftar tetap lega. */}
        <span className="block [@media(max-height:760px)]:hidden">{t.catatan}</span>
      </p>
      {rincian && rincian.hari === data?.hari && <KartuRincian rincian={rincian} t={t} />}
    </div>
  );
}

/** Kolom samping yang diciutkan (layar ≥ lg): bilah tipis berjudul tegak,
 *  seluruhnya satu tombol untuk membentangkan panel lagi. */
export function RelPeringkatHotspot({ onBuka, bahasa }: { onBuka: () => void; bahasa: Bahasa }) {
  const t = TEKS[bahasa];
  return (
    <button
      type="button"
      onClick={onBuka}
      aria-label={t.bukaPanel}
      title={t.bukaPanel}
      className="flex h-full w-full cursor-pointer flex-col items-center gap-3 bg-white py-3 text-tinta/60 transition-colors hover:bg-black/[0.03] hover:text-tinta dark:bg-pantau-konsol dark:text-white/60 dark:hover:bg-white/[0.06] dark:hover:text-white"
    >
      <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <path d="M9 3v18m5-12 3 3-3 3" />
      </svg>
      <span className="rotate-180 text-[12px] font-semibold [writing-mode:vertical-rl]">{t.judul}</span>
    </button>
  );
}
