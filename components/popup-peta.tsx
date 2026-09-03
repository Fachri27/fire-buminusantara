"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { gunakanTumbuh, type TitikAsal } from "@/hooks/gunakan-tumbuh";
import { PULAU_TAB, tabDariPulau, waktuIso, waktuTeks } from "@/lib/tanggal";
import { PROVINSI_KE_PULAU } from "@/lib/wilayah";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import type { Berita } from "@/lib/events";

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
  const relRef = useRef<HTMLDivElement | null>(null);

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

  const adalahWilayahAwal = tabAktif === tabAwal;
  const judulTampil = adalahWilayahAwal ? nama : tab.label;
  const subTampil = adalahWilayahAwal ? (pulau ?? tab.label) : tab.label;
  const jumlahTampil = adalahWilayahAwal ? jumlah : totalLaporanTab;

  /* Pada strip yang digulir, tab aktif bisa berada di luar layar: menekan Papua
     di peta membuka pop-up dengan tab Papua aktif sementara yang terlihat baru
     Sumatera. scrollLeft disetel langsung, bukan lewat scrollIntoView, yang
     ikut menggulir leluhurnya — termasuk halaman di belakang pop-up. */
  useEffect(() => {
    const rel = relRef.current;
    const aktif = rel?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!rel || !aktif) return;
    rel.scrollLeft = Math.max(0, aktif.offsetLeft - (rel.clientWidth - aktif.offsetWidth) / 2);
  }, [tabAktif]);

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
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label="Berita karhutla wilayah terpilih"
           className="peta-popup fixed inset-x-[clamp(10px,4vw,190px)] top-[calc(4rem+clamp(10px,2.4vw,26px))]
                      bottom-[clamp(10px,2.4vw,26px)] z-[45] flex flex-col overflow-hidden rounded-[14px]
                      bg-white text-tinta shadow-[0_26px_70px_rgb(0_0_0/0.45)]
                      panggung:inset-x-[7vw] panggung:top-[calc(4rem+3vh)] panggung:bottom-[5vh]">

        {/* Kepala: wilayah yang ditekan / tab yang aktif */}
        <div className="flex shrink-0 items-start gap-[clamp(10px,2.6vw,14px)] border-b border-black/10
                        p-[clamp(14px,3.4vw,20px)] pr-[54px] panggung:p-[22px_28px] panggung:pr-[76px]">
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
                  className="absolute top-[clamp(12px,3vw,18px)] right-[clamp(12px,3vw,18px)] z-[1] grid size-[32px]
                             cursor-pointer place-items-center rounded-full border border-black/10 bg-black/5
                             text-tinta transition hover:rotate-90 hover:bg-black/10 panggung:size-[34px]">
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" className="size-4">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        {/* Saringan tanggal + tab pulau */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-black/10
                        px-[clamp(14px,3.4vw,20px)] py-[10px] panggung:px-[28px]">
          <DateRangePicker
            dari={dari}
            sampai={sampai}
            onChange={({ dari, sampai }) => {
              setDari(dari);
              setSampai(sampai);
            }}
          />

          {/* Satu baris yang digulir mendatar, bukan dibungkus jadi dua baris:
              keenam labelnya melipat ke baris kedua di ponsel dan barisnya jadi
              terbaca seperti dua kelompok tab yang berbeda. Bilah gulirnya
              disembunyikan — yang menandai masih ada lanjutannya adalah label
              yang terpotong di tepi. */}
          <div ref={relRef} role="tablist" aria-label="Pulau"
               className="tanpa-bilah-gulir flex w-full min-w-0 items-center gap-4 overflow-x-auto
                          panggung:w-auto panggung:justify-end panggung:overflow-visible">
            {PULAU_TAB.map((t) => (
              <button key={t.kunci} type="button" role="tab"
                      aria-selected={tabAktif === t.kunci}
                      onClick={() => setTabAktif(t.kunci)}
                      className={`cursor-pointer shrink-0 text-[length:var(--ukuran-catatan)] font-semibold whitespace-nowrap
                                  transition-colors ${
                        tabAktif === t.kunci ? "text-tinta" : "text-black/60 hover:text-black/85"
                      }`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Daftar berita */}
        <div className="min-h-0 flex-1 overflow-y-auto px-[clamp(14px,3.4vw,20px)] panggung:px-[28px]">
          {tampil.length > 0 ? (
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
                          className="group -mx-2.5 flex w-[calc(100%+1.25rem)] cursor-pointer items-center
                                     gap-[clamp(14px,3.6vw,36px)] rounded-[10px] px-2.5 py-[clamp(14px,2.8vw,22px)]
                                     text-left transition-colors hover:bg-black/[0.03] panggung:gap-[48px] panggung:py-[24px]">
                    <div className="relative shrink-0 overflow-hidden rounded-[10px] bg-black/5 ring-1 ring-black/10">
                      {awal?.jenis === "video" ? (
                        /* #t=0.5 meminta peramban melompat ke detik itu; tanpa itu
                           <video> tanpa poster berhenti di bingkai kosong. Poster
                           bingkai otomatis (bila ada) tampil lebih instan. */
                        <video src={`${awal.url}#t=0.5`} poster={awal.poster} preload="metadata" muted
                               playsInline aria-hidden="true"
                               className="h-[clamp(80px,18vw,120px)] w-[clamp(120px,27vw,190px)] object-cover
                                          transition-transform duration-300 group-hover:scale-105
                                          panggung:h-[130px] panggung:w-[210px]" />
                      ) : awal ? (
                        <img src={awal.url} alt="" aria-hidden="true"
                             className="h-[clamp(80px,18vw,120px)] w-[clamp(120px,27vw,190px)] object-cover
                                        transition-transform duration-300 group-hover:scale-105
                                        panggung:h-[130px] panggung:w-[210px]" />
                      ) : (
                        // Tanpa media: tidak menampilkan foto dummy — kotak
                        // pratinjau memuat petunjuk lokasi saja.
                        <div aria-hidden="true"
                             className="flex h-[clamp(80px,18vw,120px)] w-[clamp(120px,27vw,190px)] items-center
                                        justify-center bg-[linear-gradient(150deg,#eef1f4,#d7dee4)]
                                        panggung:h-[130px] panggung:w-[210px]">
                          <span className="rounded-full bg-white/70 px-2.5 py-0.5 text-[10px] font-semibold
                                           uppercase tracking-wide text-black/45">
                            {b.pulau || "Belum ada foto"}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[length:var(--ukuran-tanggal)] leading-[1.2] font-normal text-black/60
                                    transition-colors group-hover:text-black/80">
                        • {b.tanggal} •
                      </p>
                      <p className="mt-[clamp(6px,1.8vw,12px)] text-[length:var(--ukuran-judul)] leading-[1.25]
                                    font-bold text-tinta transition-colors group-hover:text-api
                                    panggung:mt-[14px] panggung:text-[26px]">
                        {b.judul}
                      </p>
                    </div>
                  </button>
                </li>
                );
              })}
            </ul>
          ) : (
            <p className="py-[clamp(24px,7vw,48px)] text-[length:var(--ukuran-catatan)] leading-[1.5] text-black/70">
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
