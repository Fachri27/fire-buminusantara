"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { gunakanTumbuh, type TitikAsal } from "@/hooks/gunakan-tumbuh";
import { PULAU_TAB, tabDariPulau, waktuIso, waktuTeks } from "@/lib/tanggal";
import { PROVINSI_KE_PULAU } from "@/lib/wilayah";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import type { Berita } from "@/lib/events";
import type { ItemMedia } from "@/lib/media";

type Props = {
  nama: string;
  pulau: string | null;
  jumlah: number | null;
  /** Titik layar tempat pop-up tumbuh — provinsi yang ditekan. */
  asal: TitikAsal;
  berita: Berita[];
  jumlahLaporan?: Record<string, number>;
  onBukaRincian: (i: number) => void;
  onTutup: () => void;
};

/** Mode tampilan daftar berita: baris ringkas atau kartu bergambar. */
type ModeTampilan = "daftar" | "kartu";

/** Banyak kartu yang tampak pertama pada mode kartu — dua baris lima kolom. */
const KARTU_AWAL = 10;
/** Tiap tombol muat lebih banyak menambah satu baris (lima kartu). */
const KARTU_PER_BARIS = 5;

/**
 * Pop-up berita wilayah, terbuka saat sebuah provinsi ditekan di peta.
 *
 * Wilayah yang ditekan hanya menentukan tab mana yang terbuka lebih dulu;
 * sesudah itu pop-up ini menjadi jalan masuk ke SELURUH berita, jadi tabnya
 * bebas dipindah.
 */
export function PopupPeta({
  nama,
  pulau,
  jumlah,
  asal,
  berita,
  jumlahLaporan,
  onBukaRincian,
  onTutup,
}: Props) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line react-hooks/refs
  gunakanTumbuh(panelRef, asal);
  const [tabAktif, setTabAktif] = useState(() => tabDariPulau(pulau) ?? PULAU_TAB[0].kunci);
  const [prevPulau, setPrevPulau] = useState(pulau);
  if (pulau !== prevPulau) {
    setPrevPulau(pulau);
    setTabAktif(tabDariPulau(pulau) ?? PULAU_TAB[0].kunci);
  }
  // `dari` dan `sampai` disimpan terpisah karena penyaringnya memakai keduanya.
  const [dari, setDari] = useState("");
  const [sampai, setSampai] = useState("");
  // Mode tampilan daftar berita — dipilih lewat saklar kartu/daftar di bilah saringan.
  const [tampilan, setTampilan] = useState<ModeTampilan>("daftar");
  // Banyak kartu yang sudah tampak pada mode kartu. Kembali ke jumlah awal
  // saat tab pulau atau saringan tanggal berganti — daftar barunya, hitungannya
  // baru.
  const [jumlahKartu, setJumlahKartu] = useState(KARTU_AWAL);
  useEffect(() => {
    setJumlahKartu(KARTU_AWAL);
  }, [tabAktif, dari, sampai]);

  const adaSaringan = Boolean(dari || sampai);
  const hapusTanggal = () => {
    setDari("");
    setSampai("");
  };

  const tabAwal = useMemo(() => tabDariPulau(pulau) ?? PULAU_TAB[0].kunci, [pulau]);
  const tab = PULAU_TAB.find((t) => t.kunci === tabAktif) ?? PULAU_TAB[0];

  // Hitung total laporan per tab pulau dari seluruh provinsi
  const totalLaporanTab = useMemo(() => {
    if (!jumlahLaporan) return null;
    const isi = tab.isi as readonly string[];
    let total = 0;
    for (const [prov, jml] of Object.entries(jumlahLaporan)) {
      const p = PROVINSI_KE_PULAU[prov];
      if (p && isi.includes(p)) {
        total += jml;
      }
    }
    return total;
  }, [tab, jumlahLaporan]);

  // Hitung total laporan untuk setiap tab pulau untuk ditampilkan di dropdown select
  const jumlahLaporanSemuaTab = useMemo(() => {
    const hasil: Record<string, number> = {};
    if (!jumlahLaporan) return hasil;
    for (const t of PULAU_TAB) {
      const isi = t.isi as readonly string[];
      let total = 0;
      for (const [prov, jml] of Object.entries(jumlahLaporan)) {
        const p = PROVINSI_KE_PULAU[prov];
        if (p && isi.includes(p)) {
          total += jml;
        }
      }
      hasil[t.kunci] = total;
    }
    return hasil;
  }, [jumlahLaporan]);

  const adalahWilayahAwal = tabAktif === tabAwal;
  const judulTampil = adalahWilayahAwal ? nama : tab.label;
  const subTampil = adalahWilayahAwal ? (pulau ?? tab.label) : tab.label;
  const jumlahTampil = adalahWilayahAwal ? jumlah : totalLaporanTab;

  const tampil = useMemo(() => {
    const isi = tab.isi as readonly string[];
    const awal = waktuIso(dari);
    const akhir = waktuIso(sampai);

    return berita
      .map((b, i) => ({ b, i }))
      .filter(({ b }) => {
        if (!b.pulau || !isi.includes(b.pulau)) return false;
        const waktu = waktuTeks(b.tanggal);
        if (waktu === null) return true; // tanggal tak terbaca: jangan disembunyikan
        if (awal !== null && waktu < awal) return false;
        if (akhir !== null && waktu > akhir) return false;
        return true;
      });
  }, [berita, tab, dari, sampai]);

  // Kartu yang benar-benar dirender pada mode kartu — lima pertama, bertambah
  // lima tiap tombol muat lebih banyak, berhenti di sepuluh.
  const kartuTampak = tampil.slice(0, Math.min(jumlahKartu, MAKS_KARTU));
  const masihAdaKartu = tampil.length > kartuTampak.length && kartuTampak.length < MAKS_KARTU;

  useEffect(() => {
    const saatTombol = (e: KeyboardEvent) => { if (e.key === "Escape") onTutup(); };
    window.addEventListener("keydown", saatTombol);
    return () => window.removeEventListener("keydown", saatTombol);
  }, [onTutup]);

  return (
    /* Tanpa tabir gelap. Pop-up ini memang panel yang menutupi sebagian besar
       layar, bukan dialog di atas kain hitam — petanya masih terlihat di
       tepinya, dan itu yang membuat kaitannya dengan wilayah yang ditekan
       tetap terbaca. Menutupnya lewat tombol tutup atau Escape. */
    <>
      {/* Backdrop semi-transparan yang menutup saat disentuh/diklik di luar popup */}
      <div
        className="fixed inset-0 z-[44] bg-black/50 backdrop-blur-[2px] transition-opacity"
        onClick={onTutup}
        aria-hidden="true"
      />

      <div ref={panelRef} role="dialog" aria-modal="true" aria-label="Berita karhutla wilayah terpilih"
           className="peta-popup fixed inset-x-2.5 sm:inset-x-[clamp(10px,4vw,190px)]
                      top-[calc(3.75rem+env(safe-area-inset-top,0px))] sm:top-[calc(4rem+clamp(10px,2.4vw,26px))]
                      bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:bottom-[clamp(10px,2.4vw,26px)]
                      z-[45] flex flex-col overflow-hidden rounded-[14px]
                      bg-white text-tinta shadow-[0_26px_70px_rgb(0_0_0/0.45)]
                      panggung:inset-x-[7vw] panggung:top-[calc(4rem+3vh)] panggung:bottom-[5vh]">

        {/* Kepala: wilayah yang ditekan / tab yang aktif */}
        <div className="flex shrink-0 items-start gap-2.5 sm:gap-[clamp(10px,2.6vw,14px)] border-b border-black/10
                        p-3 sm:p-5 pr-12 sm:pr-[54px] panggung:p-[22px_28px] panggung:pr-[76px]">
          <div className="grid min-w-0 flex-1 gap-[2px]">
            <p className="text-[length:var(--ukuran-rincian-nama)] leading-[1.1] font-bold tracking-[-0.01em]">
              {judulTampil}
            </p>
            {subTampil && (
              <p className="text-[length:var(--ukuran-catatan)] font-medium tracking-[0.1em] uppercase text-bara">
                {subTampil}
              </p>
            )}
            {jumlahTampil !== null && (
              <p className="mt-1 text-[length:var(--ukuran-catatan)] text-black/70">
                <span className="font-bold text-tinta">{jumlahTampil.toLocaleString("id-ID")}</span>{" "}
                <span>laporan tercatat</span>
              </p>
            )}
          </div>

          <button type="button" aria-label="Tutup berita wilayah" onClick={onTutup}
                  className="absolute top-3 right-3 sm:top-[clamp(12px,3vw,18px)] sm:right-[clamp(12px,3vw,18px)] z-[1] grid size-8 sm:size-[32px]
                             cursor-pointer place-items-center rounded-full border border-black/10 bg-black/5
                             text-tinta transition hover:rotate-90 hover:bg-black/10 active:scale-95 panggung:size-[34px]">
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" className="size-4">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        {/* Saringan tanggal + dropdown pilih pulau */}
        <div className="flex shrink-0 flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 border-b border-black/10
                        p-3 sm:p-5 py-2.5 sm:py-[10px] panggung:px-[28px]">
          <DateRangePicker
            dari={dari}
            sampai={sampai}
            onChange={({ dari, sampai }) => {
              setDari(dari);
              setSampai(sampai);
            }}
          />

          {/* Dropdown Select Wilayah Pulau Tercatat (Sesuai Arahan) + saklar
              mode tampilan daftar/kartu */}
          <div className="flex w-full sm:w-auto items-stretch sm:items-center gap-2 sm:gap-2.5">
            <div className="relative min-w-0 flex-1 sm:flex-none sm:min-w-[220px]">
              <select
                id="pilih-wilayah-pulau"
                value={tabAktif}
                onChange={(e) => setTabAktif(e.target.value)}
                aria-label="Pilih wilayah pulau tercatat"
                className="w-full appearance-none rounded-lg border border-black/15 bg-white py-1.5 pl-3 pr-8 text-xs sm:text-sm font-semibold text-tinta shadow-xs outline-none transition-colors hover:border-black/30 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 cursor-pointer"
              >
                {PULAU_TAB.map((t) => {
                  const jml = jumlahLaporanSemuaTab[t.kunci];
                  return (
                    <option key={t.kunci} value={t.kunci}>
                      {t.label} {jml !== undefined ? `(${jml} laporan)` : ""}
                    </option>
                  );
                })}
              </select>
              <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-black/45">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </div>
            </div>

            {/* Saklar mode tampilan: daftar (baris ringkas) atau kartu (kotak
                bergambar). Segmen aktif mengikuti rupa bilah saringan lain. */}
            <div role="group" aria-label="Mode tampilan berita"
                 className="flex shrink-0 items-center gap-0.5 self-center rounded-lg border border-black/15 bg-white p-0.5 shadow-xs">
              <TombolTampilan aktif={tampilan === "daftar"} label="Tampilan daftar"
                              onClick={() => setTampilan("daftar")}>
                <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"
                     strokeWidth="2" strokeLinecap="round" className="size-[15px]">
                  <path d="M9 6h11M9 12h11M9 18h11" />
                  <path d="M4 6h.01M4 12h.01M4 18h.01" strokeWidth="2.6" />
                </svg>
              </TombolTampilan>
              <TombolTampilan aktif={tampilan === "kartu"} label="Tampilan kartu"
                              onClick={() => setTampilan("kartu")}>
                <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"
                     strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-[15px]">
                  <rect x="4" y="4" width="7" height="7" rx="1.5" />
                  <rect x="13" y="4" width="7" height="7" rx="1.5" />
                  <rect x="4" y="13" width="7" height="7" rx="1.5" />
                  <rect x="13" y="13" width="7" height="7" rx="1.5" />
                </svg>
              </TombolTampilan>
            </div>
          </div>
        </div>

        {/* Daftar berita. data-lenis-prevent: saat pop-up terbuka Lenis
            dihentikan (gunakanParallax), dan Lenis yang berhenti tetap menelan
            event roda dengan preventDefault — rel inilah satu-satunya yang
            dikecualikan, sehingga gulir bawaan peramban hidup kembali di
            dalamnya. overscroll-contain menahan rantai gulir agar menyentuh
            dasar/tepinya tidak ikut menggulirkan halaman di belakang. */}
        <div data-lenis-prevent
             className="tanpa-bilah-gulir min-h-0 flex-1 overflow-y-auto overscroll-contain touch-pan-y
                        p-3 sm:p-5 panggung:px-[28px]">
          {tampil.length > 0 ? (
            tampilan === "kartu" ? (
              /* Mode kartu: kotak bergambar berpetak — pratinjau 16:10 di
                 atas, tanggal + judul di bawah, lokasi menempel di dasar
                 supaya barisan kartu terlihat rapi meski judulnya beda panjang. */
              <>
              <ul className="grid grid-cols-1 min-[430px]:grid-cols-2 gap-3 sm:gap-4
                             panggung:grid-cols-3 panggung:gap-[20px] xl:grid-cols-3">
                {kartuTampak.map(({ b, i }) => {
                  const awal = b.media[0];
                  return (
                    <li key={b.id}>
                      <button type="button" onClick={() => onBukaRincian(i)}
                              className="group flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-[10px]
                                         bg-white text-left shadow-[0_1px_3px_rgb(0_0_0/0.08)] ring-1 ring-black/10
                                         transition-[transform,box-shadow] duration-300
                                         hover:-translate-y-0.5 hover:shadow-[0_12px_26px_rgb(0_0_0/0.14)]
                                         active:translate-y-0">
                        <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden bg-black/5">
                          <PratinjauMedia awal={awal} pulau={b.pulau}
                                          kelas="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                        </div>
                        <div className="flex flex-1 flex-col p-3 sm:p-3.5">
                          <p className="text-[length:var(--ukuran-tanggal)] leading-[1.2] font-normal text-black/60
                                        transition-colors group-hover:text-black/80">
                            • {b.tanggal} •
                          </p>
                          <p className="mt-1.5 text-[length:var(--ukuran-judul)] leading-[1.3]
                                        font-bold text-tinta transition-colors group-hover:text-api line-clamp-3">
                            {b.judul}
                          </p>
                          {b.lokasi && (
                            <div className="mt-auto pt-3">
                              <p className="flex items-start gap-1.5 border-t border-black/[0.06] pt-2
                                            text-[length:var(--ukuran-catatan)] leading-[1.35] text-black/55">
                                <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"
                                     strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                                     className="mt-[1px] size-3 shrink-0">
                                  <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" />
                                  <circle cx="12" cy="10" r="3" />
                                </svg>
                                <span className="line-clamp-2">{b.lokasi}</span>
                              </p>
                            </div>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {masihAdaKartu && (
                /* Muat lebih banyak: lima kartu berikutnya per klik (maksimum
                   sepuluh), tanpa gulir ulang dari atas — daftar yang sudah
                   tampak tak bergeser. */
                <div className="mt-4 flex flex-col items-center gap-2 sm:mt-5 panggung:mt-[22px]">
                  <p className="text-[length:var(--ukuran-catatan)] text-black/55">
                    Menampilkan {kartuTampak.length} dari {tampil.length} laporan
                  </p>
                  <button
                    type="button"
                    onClick={() => setJumlahKartu((n) => Math.min(n + BATAS_KARTU, MAKS_KARTU))}
                    className="flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-lg border border-black/15
                               bg-white px-4 py-1.5 text-xs sm:text-sm font-semibold text-tinta shadow-xs
                               transition-colors hover:border-black/30 hover:bg-black/[0.03]
                               focus-visible:border-amber-500 focus-visible:ring-1 focus-visible:ring-amber-500
                               focus-visible:outline-none"
                  >
                    Muat lebih banyak
                    <svg viewBox="0 0 24 24" aria-hidden="true" width="15" height="15" fill="none"
                         stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>
                </div>
              )}
              </>
            ) : (
            <ul>
              {tampil.map(({ b, i }) => {
                /* Pratinjau diambil dari media asli kejadian (galeri `media`),
                   bukan dari `gambar` yang tadinya selalu diberi foto bawaan —
                   kartu kejadian bervideo-galeri tampil dengan foto dummy yang
                   sama semua. Kejadian tanpa media sama sekali menampilkan
                   placeholder lokasi, bukan foto dummy. */
                const awal = b.media[0];
                return (
                <li key={b.id} className="border-b border-black/10 last:border-b-0">
                  <button type="button" onClick={() => onBukaRincian(i)}
                          className="group -mx-2 flex w-[calc(100%+1rem)] sm:-mx-2.5 sm:w-[calc(100%+1.25rem)] cursor-pointer items-center
                                     gap-3 sm:gap-[clamp(14px,3.6vw,36px)] rounded-[10px] p-2 sm:px-2.5 sm:py-[clamp(14px,2.8vw,22px)]
                                     text-left transition-colors hover:bg-black/[0.03] active:bg-black/[0.06] panggung:gap-[48px] panggung:py-[24px]">
                    <div className="relative shrink-0 overflow-hidden rounded-[10px] bg-black/5 ring-1 ring-black/10">
                      <PratinjauMedia awal={awal} pulau={b.pulau}
                                      kelas="h-[76px] w-[104px] sm:h-[clamp(80px,18vw,120px)] sm:w-[clamp(120px,27vw,190px)] object-cover
                                             transition-transform duration-300 group-hover:scale-105
                                             panggung:h-[130px] panggung:w-[210px]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[length:var(--ukuran-tanggal)] leading-[1.2] font-normal text-black/60
                                    transition-colors group-hover:text-black/80">
                        • {b.tanggal} •
                      </p>
                      <p className="mt-1 sm:mt-[clamp(6px,1.8vw,12px)] text-[length:var(--ukuran-judul)] leading-[1.25]
                                    font-bold text-tinta transition-colors group-hover:text-api panggung:mt-[10px]">
                        {b.judul}
                      </p>
                    </div>
                  </button>
                </li>
                );
              })}
            </ul>
            )
          ) : (
            <p className="py-6 sm:py-[clamp(24px,7vw,48px)] text-[length:var(--ukuran-catatan)] leading-[1.5] text-black/70">
              Belum ada laporan untuk <span className="font-semibold">{tab.label}</span>
              {adaSaringan ? " pada rentang tanggal ini" : ""}.
              {adaSaringan && (
                <button type="button" onClick={hapusTanggal}
                        className="mt-2 block font-semibold text-bara underline underline-offset-2
                                   transition-colors hover:text-api">
                  Hapus saringan tanggal
                </button>
              )}
            </p>
          )}
        </div>
      </div>
    </>
  );
}

/** Pratinjau media pertama kejadian untuk kedua mode tampilan: video (dengan
 *  poster/bingkai #t=0.5), foto, atau petunjuk lokasi saat kejadian tak punya
 *  media sama sekali — bukan foto dummy. `kelas` menentukan kotaknya agar
 *  baris daftar (kotak tetap) dan kartu (kotak 16:10) bisa berbagi logika. */
function PratinjauMedia({ awal, pulau, kelas }: {
  awal: ItemMedia | undefined;
  pulau: string | null;
  kelas: string;
}) {
  if (awal?.jenis === "video") {
    /* #t=0.5 meminta peramban melompat ke detik itu; tanpa itu <video> tanpa
       poster berhenti di bingkai kosong. Poster bingkai otomatis (bila ada)
       tampil lebih instan. */
    return (
      <video src={`${awal.url}#t=0.5`} poster={awal.poster} preload="metadata" muted
             playsInline aria-hidden="true" className={kelas} />
    );
  }
  if (awal) {
    return <img src={awal.url} alt="" aria-hidden="true" className={kelas} />;
  }
  return (
    <div aria-hidden="true"
         className={`flex items-center justify-center bg-[linear-gradient(150deg,#eef1f4,#d7dee4)] ${kelas}`}>
      <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold
                       uppercase tracking-wide text-black/45">
        {pulau || "Belum ada foto"}
      </span>
    </div>
  );
}

/** Satu segmen saklar mode tampilan (daftar/kartu). */
function TombolTampilan({ aktif, label, onClick, children }: {
  aktif: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} aria-pressed={aktif} aria-label={label} title={label}
            className={`grid size-[26px] cursor-pointer place-items-center rounded-[6px] transition-colors sm:size-[28px]
                        ${aktif ? "bg-black/[0.08] text-tinta" : "text-black/45 hover:bg-black/[0.04] hover:text-tinta"}`}>
      {children}
    </button>
  );
}
