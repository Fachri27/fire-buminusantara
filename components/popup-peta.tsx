"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { gunakanTumbuh, type TitikAsal } from "@/hooks/gunakan-tumbuh";
import { waktuIso, waktuTeks } from "@/lib/tanggal";
import { PROVINSI_KE_PULAU, PROVINSI_PETA_NAMA } from "@/lib/wilayah";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import type { Berita } from "@/lib/events";
import type { ItemMedia } from "@/lib/media";

type Props = {
  /** Provinsi yang ditekan — daftar awal berisi laporan provinsi ini. */
  nama: string;
  pulau: string | null;
  jumlah: number | null;
  /** Titik layar tempat pop-up tumbuh — provinsi yang ditekan. */
  asal: TitikAsal;
  berita: Berita[];
  /** Hitungan per provinsi (34 nama kanonik, yang nol ikut ada) — mengisi
   *  judul, angka kepala, dan daftar pilihan provinsi. */
  jumlahLaporan: Record<string, number>;
  onBukaRincian: (i: number) => void;
  onTutup: () => void;
};

/** Mode tampilan daftar berita: baris ringkas atau kartu bergambar. */
type ModeTampilan = "daftar" | "kartu";

/** Banyak laporan per halaman — sepuluh baris pada mode daftar, atau dua
 *  baris lima kartu pada mode kartu. Satu angka untuk keduanya supaya ganti
 *  mode tak mengubah total halaman di kepala pengunjung. */
const PER_HALAMAN = 10;

/**
 * Pop-up berita wilayah, terbuka saat sebuah provinsi ditekan di peta.
 *
 * Isinya per provinsi yang dipilih — bukan se-pulau. Pengelompokan se-pulau
 * pernah dipakai di sini dan membuat kepala ("4 laporan tercatat") berbohong
 * terhadap daftarnya (17 se-Kalimantan). Pilihan provinsi bisa diganti lewat
 * dropdown berkaca di bilah saringan tanpa menutup pop-up.
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
  // Provinsi yang daftarnya tampil — diawali dari yang ditekan di peta,
  // bisa diganti lewat dropdown berkaca.
  const [provinsiAktif, setProvinsiAktif] = useState(nama);
  // Dropdown pilih provinsi: ketikan penyaring + status terbuka.
  const [cariProvinsi, setCariProvinsi] = useState("");
  const [pilihTerbuka, setPilihTerbuka] = useState(false);
  const pilihRef = useRef<HTMLDivElement | null>(null);
  // `dari` dan `sampai` disimpan terpisah karena penyaringnya memakai keduanya.
  const [dari, setDari] = useState("");
  const [sampai, setSampai] = useState("");
  // Mode tampilan daftar berita — bawaan kartu bergambar, dipilih lewat
  // saklar kartu/daftar di bilah saringan.
  const [tampilan, setTampilan] = useState<ModeTampilan>("kartu");
  // Halaman aktif pada kedua mode. Kembali ke halaman pertama saat provinsi
  // atau saringan tanggal berganti — daftarnya baru, halamannya ikut baru.
  const [halaman, setHalaman] = useState(1);
  const [kunciSaringanSebelumnya, setKunciSaringanSebelumnya] = useState(() => `${nama}:${dari}:${sampai}`);
  const kunciSaringanKini = `${provinsiAktif}:${dari}:${sampai}`;
  if (kunciSaringanKini !== kunciSaringanSebelumnya) {
    setKunciSaringanSebelumnya(kunciSaringanKini);
    setHalaman(1);
  }
  // Rel gulir daftar — pindah halaman mengembalikannya ke atas supaya
  // pengunjung selalu mulai dari laporan pertama halaman itu.
  const daftarRef = useRef<HTMLDivElement | null>(null);
  const keHalaman = (h: number) => {
    setHalaman(h);
    daftarRef.current?.scrollTo({ top: 0 });
  };

  const adaSaringan = Boolean(dari || sampai);
  const hapusTanggal = () => {
    setDari("");
    setSampai("");
  };

  const tampil = useMemo(() => {
    const awal = waktuIso(dari);
    const akhir = waktuIso(sampai);

    return berita
      .map((b, i) => ({ b, i }))
      .filter(({ b }) => {
        // Hanya provinsi yang dipilih — tanpa gabungan se-pulau.
        if (b.provinsi !== provinsiAktif) return false;
        const waktu = waktuTeks(b.tanggal);
        if (waktu === null) return true; // tanggal tak terbaca: jangan disembunyikan
        if (awal !== null && waktu < awal) return false;
        if (akhir !== null && waktu > akhir) return false;
        return true;
      });
  }, [berita, provinsiAktif, dari, sampai]);

  // Daftar 34 provinsi untuk dropdown — yang laporannya terbanyak dulu, seri
  // diurut abjad; ketikan di kotak cari menyaringnya. Angka ikut supaya
  // provinsi kosong (0 laporan) tetap terlihat dan bisa dipilih.
  const daftarProvinsi = useMemo(() => {
    const semua = PROVINSI_PETA_NAMA.map((p) => ({
      nama: p,
      jumlah: jumlahLaporan[p] ?? 0,
    }));
    semua.sort((a, b) => b.jumlah - a.jumlah || a.nama.localeCompare(b.nama, "id"));
    const q = cariProvinsi.trim().toLowerCase();
    return q ? semua.filter((p) => p.nama.toLowerCase().includes(q)) : semua;
  }, [jumlahLaporan, cariProvinsi]);

  // Angka kepala mengikuti pilihan — peta hitungannya sudah mencakup 34
  // provinsi; cadangan `jumlah` untuk provinsi awal bila petanya belum ada.
  const jumlahAktif = jumlahLaporan[provinsiAktif] ?? (provinsiAktif === nama ? jumlah : 0) ?? 0;

  const pilihProvinsi = (p: string) => {
    setProvinsiAktif(p);
    setPilihTerbuka(false);
    setCariProvinsi("");
  };

  // Sentuh/klik di luar dropdown menutupnya — kombobox buatan sendiri, jadi
  // penutupnya dibuat sendiri (select bawaan tak bisa diketik untuk mencari).
  useEffect(() => {
    if (!pilihTerbuka) return;
    const tutup = (e: MouseEvent) => {
      if (pilihRef.current && !pilihRef.current.contains(e.target as Node)) {
        setPilihTerbuka(false);
      }
    };
    document.addEventListener("mousedown", tutup);
    return () => document.removeEventListener("mousedown", tutup);
  }, [pilihTerbuka]);

  // Potongan daftar untuk halaman aktif — berlaku untuk kedua mode. Indeks
  // `i` di tiap butir tetap menunjuk ke posisi global di `berita` supaya
  // rincian yang dibuka tak salah sasaran. totalHalaman dihitung turun (bukan
  // state) agar penyegaran data yang menyusutkan daftar tak meninggalkan
  // halaman hantu.
  const totalHalaman = Math.max(1, Math.ceil(tampil.length / PER_HALAMAN));
  const halamanAktif = Math.min(Math.max(1, halaman), totalHalaman);
  const tampilHalaman = tampil.slice((halamanAktif - 1) * PER_HALAMAN, halamanAktif * PER_HALAMAN);
  const awalNomor = tampil.length === 0 ? 0 : (halamanAktif - 1) * PER_HALAMAN + 1;
  const akhirNomor = Math.min(halamanAktif * PER_HALAMAN, tampil.length);

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
        className="fixed inset-0 z-[44] bg-black/50 transition-opacity"
        onClick={onTutup}
        aria-hidden="true"
      />

      <div ref={panelRef} role="dialog" aria-modal="true" aria-label="Berita karhutla wilayah terpilih"
           onWheel={(e) => e.stopPropagation()}
           className="peta-popup fixed inset-x-2.5 sm:inset-x-[clamp(10px,4vw,190px)]
                      top-[calc(3.75rem+env(safe-area-inset-top,0px))] sm:top-[calc(4rem+clamp(10px,2.4vw,26px))]
                      bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:bottom-[clamp(10px,2.4vw,26px)]
                      z-[45] flex flex-col overflow-hidden rounded-[14px]
                      bg-white text-tinta shadow-[0_26px_70px_rgb(0_0_0/0.45)]
                      panggung:inset-x-[7vw] panggung:top-[calc(4rem+3vh)] panggung:bottom-[5vh]">

        {/* Kepala: provinsi yang dipilih — angka dan daftarnya satu sumber */}
        <div className="flex shrink-0 items-start gap-2.5 sm:gap-[clamp(10px,2.6vw,14px)] border-b border-black/10
                        p-3 sm:p-5 pr-12 sm:pr-[54px] panggung:p-[22px_28px] panggung:pr-[76px]">
          <div className="grid min-w-0 flex-1 gap-[2px]">
            <p className="text-[length:var(--ukuran-rincian-nama)] leading-[1.1] font-bold tracking-[-0.01em]">
              {provinsiAktif}
            </p>
            {(PROVINSI_KE_PULAU[provinsiAktif] ?? pulau) && (
              <p className="text-[length:var(--ukuran-catatan)] font-medium tracking-[0.1em] uppercase text-bara">
                {PROVINSI_KE_PULAU[provinsiAktif] ?? pulau}
              </p>
            )}
            <p className="mt-1 text-[length:var(--ukuran-catatan)] text-black/70">
              <span className="font-bold text-tinta">{jumlahAktif.toLocaleString("id-ID")}</span>{" "}
              <span>laporan tercatat</span>
            </p>
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

        {/* Saringan tanggal + saklar mode tampilan */}
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

          {/* Dropdown pilih provinsi + saklar mode tampilan */}
          <div className="flex w-full sm:w-auto items-stretch sm:items-center gap-2 sm:gap-2.5">
            <div ref={pilihRef} className="relative min-w-0 flex-1 sm:flex-none sm:min-w-[220px]">
              <button
                type="button"
                onClick={() => setPilihTerbuka((buka) => !buka)}
                aria-haspopup="listbox"
                aria-expanded={pilihTerbuka}
                aria-label="Pilih provinsi"
                className="w-full appearance-none rounded-lg border border-black/15 bg-white py-1.5 pl-3 pr-8 text-xs sm:text-sm font-semibold text-tinta shadow-xs outline-none transition-colors hover:border-black/30 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 cursor-pointer text-left truncate"
              >
                {provinsiAktif} ({jumlahAktif} laporan)
              </button>
              <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-black/45">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </div>

              {pilihTerbuka && (
                <div className="absolute right-0 left-0 sm:left-auto sm:w-[260px] top-full z-[5] mt-1 overflow-hidden rounded-lg border border-black/15 bg-white shadow-[0_16px_40px_rgb(0_0_0/0.18)]">
                  <div className="border-b border-black/10 p-1.5">
                    <input
                      type="search"
                      autoFocus
                      value={cariProvinsi}
                      onChange={(e) => setCariProvinsi(e.target.value)}
                      onKeyDown={(e) => {
                        // Escape di kotak cari hanya menutup dropdown — tanpa
                        // ini ia menggelembung ke penutup pop-up seutuhnya.
                        if (e.key === "Escape") {
                          e.stopPropagation();
                          setPilihTerbuka(false);
                        }
                      }}
                      placeholder="Cari provinsi…"
                      aria-label="Cari provinsi"
                      className="w-full rounded-md border border-black/10 bg-black/[0.03] px-2.5 py-1.5 text-xs sm:text-sm text-tinta outline-none placeholder:text-black/35 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <ul role="listbox" aria-label="Daftar provinsi"
                      className="max-h-[240px] overflow-y-auto overscroll-contain p-1">
                    {daftarProvinsi.length > 0 ? (
                      daftarProvinsi.map((p) => {
                        const aktif = p.nama === provinsiAktif;
                        return (
                          <li key={p.nama} role="option" aria-selected={aktif}>
                            <button
                              type="button"
                              onClick={() => pilihProvinsi(p.nama)}
                              className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-xs sm:text-sm transition-colors
                                ${aktif ? "bg-black/[0.07] font-bold text-tinta" : "font-medium text-tinta hover:bg-black/[0.04]"}`}
                            >
                              <span className="min-w-0 truncate">{p.nama}</span>
                              <span className="shrink-0 text-[11px] sm:text-xs font-normal text-black/45">
                                {p.jumlah} laporan
                              </span>
                            </button>
                          </li>
                        );
                      })
                    ) : (
                      <li className="px-2.5 py-3 text-xs sm:text-sm text-black/50">
                        Tidak ada provinsi yang cocok.
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>

          {/* Saklar mode tampilan: daftar (baris ringkas) atau kartu (kotak
              bergambar). Segmen aktif mengikuti rupa bilah saringan lain. */}
          <div role="group" aria-label="Mode tampilan berita"
               className="flex shrink-0 items-center gap-0.5 self-start sm:self-center rounded-lg border border-black/15 bg-white p-0.5 shadow-xs">
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
             ref={daftarRef}
             className="tanpa-bilah-gulir min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain touch-pan-y
                        p-3 sm:p-5 panggung:px-[28px]">
          {tampil.length > 0 ? (
            tampilan === "kartu" ? (
              /* Mode kartu: kotak bergambar berpetak — pratinjau 16:10 di
                 atas, tanggal + judul di bawah, lokasi menempel di dasar
                 supaya barisan kartu terlihat rapi meski judulnya beda panjang. */
              <>
              <ul className="grid grid-cols-1 min-[430px]:grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3
                             panggung:grid-cols-5 panggung:gap-[20px] xl:grid-cols-5">
                {tampilHalaman.map(({ b, i }) => {
                  const awal = b.media[0];
                  return (
                    <li key={b.id} className="flex">
                      <button type="button" onClick={() => onBukaRincian(i)}
                              className="group flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-xl
                                         border border-black/[0.08] bg-white text-left shadow-xs
                                         transition-all duration-200 ease-out
                                         hover:-translate-y-1 hover:border-black/15 hover:shadow-[0_10px_24px_rgb(0_0_0/0.08)]
                                         active:translate-y-0">
                        <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden bg-black/5">
                          <PratinjauMedia awal={awal} pulau={b.pulau}
                                          kelas="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                        </div>
                        <div className="flex flex-1 flex-col justify-between p-3 sm:p-3.5">
                          <div>
                            <p className="text-[11px] sm:text-xs font-medium text-black/45 transition-colors group-hover:text-black/60">
                              {b.tanggal}
                            </p>
                            <h3 className="mt-1 text-[13.5px] sm:text-[14px] font-semibold leading-snug
                                           text-tinta transition-colors group-hover:text-api line-clamp-2 sm:line-clamp-3">
                              {b.judul}
                            </h3>
                          </div>
                          {b.lokasi && (
                            <div className="mt-3 pt-2.5 border-t border-black/[0.06]">
                              <p className="flex items-start gap-1.5 text-[11px] sm:text-[11.5px] leading-snug text-black/50">
                                <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"
                                     strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                                     className="mt-0.5 size-3 shrink-0 text-black/40 transition-colors group-hover:text-black/60">
                                  <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" />
                                  <circle cx="12" cy="10" r="3" />
                                </svg>
                                <span className="line-clamp-2 transition-colors group-hover:text-black/70" title={b.lokasi}>
                                  {b.lokasi}
                                </span>
                              </p>
                            </div>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <NavigasiHalaman halaman={halamanAktif} totalHalaman={totalHalaman}
                               awal={awalNomor} akhir={akhirNomor} total={tampil.length}
                               onPilih={keHalaman} />
              </>
            ) : (
            <>
            <ul>
              {tampilHalaman.map(({ b, i }) => {
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
                      <div className="flex flex-wrap items-center gap-x-2 text-xs text-black/50">
                        <span className="font-medium text-black/50 transition-colors group-hover:text-black/70">
                          {b.tanggal}
                        </span>
                        {b.lokasi && (
                          <>
                            <span className="text-black/25">·</span>
                            <span className="truncate text-black/45">{b.lokasi}</span>
                          </>
                        )}
                      </div>
                      <p className="mt-1 sm:mt-1.5 text-sm sm:text-base font-semibold leading-snug
                                    text-tinta transition-colors group-hover:text-api">
                        {b.judul}
                      </p>
                    </div>
                  </button>
                </li>
                );
              })}
            </ul>
            <NavigasiHalaman halaman={halamanAktif} totalHalaman={totalHalaman}
                             awal={awalNomor} akhir={akhirNomor} total={tampil.length}
                             onPilih={keHalaman} />
            </>
            )
          ) : (
            <p className="py-6 sm:py-[clamp(24px,7vw,48px)] text-[length:var(--ukuran-catatan)] leading-[1.5] text-black/70">
              Belum ada laporan untuk <span className="font-semibold">{provinsiAktif}</span>
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
    /* Sengaja <img>, bukan next/image: URL galeri bisa remote warisan
       (NEXT_PUBLIC_MEDIA_URL, host dinamis) yang tak masuk remotePatterns —
       optimizer justru error runtime di situ. */
    // eslint-disable-next-line @next/next/no-img-element
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

/**
 * Navigasi halaman daftar berita — dipakai kedua mode tampilan. Klien murni
 * (tanpa query URL): datanya sudah ada semua di `berita`, jadi pindah halaman
 * hanya mengiris tampilan tanpa memuat ulang. Disembunyikan bila semuanya
 * muat dalam satu halaman.
 */
function NavigasiHalaman({ halaman, totalHalaman, awal, akhir, total, onPilih }: {
  halaman: number;
  totalHalaman: number;
  awal: number;
  akhir: number;
  total: number;
  onPilih: (h: number) => void;
}) {
  if (totalHalaman <= 1) return null;

  // Nomor dengan elipsis cerdas (1 … 4 5 6 … 12) — pola yang sama dengan
  // paginasi CMS supaya pengunjung hanya belajar sekali.
  const nomor: (number | "...")[] = [];
  for (let i = 1; i <= totalHalaman; i++) {
    if (i === 1 || i === totalHalaman || (i >= halaman - 1 && i <= halaman + 1)) {
      nomor.push(i);
    } else if (nomor[nomor.length - 1] !== "...") {
      nomor.push("...");
    }
  }

  const kelasTombol = "flex min-h-[34px] cursor-pointer items-center justify-center gap-1 rounded-lg border border-black/15 \
bg-white px-3 py-1.5 text-xs sm:text-sm font-semibold text-tinta shadow-xs \
transition-colors hover:border-black/30 hover:bg-black/[0.03] \
disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-black/15 disabled:hover:bg-white \
focus-visible:border-amber-500 focus-visible:ring-1 focus-visible:ring-amber-500 \
focus-visible:outline-none";

  return (
    <nav aria-label="Paginasi laporan"
         className="mt-4 flex flex-col items-center gap-2.5 border-t border-black/10 pt-3.5 sm:mt-5">
      <p className="text-[length:var(--ukuran-catatan)] text-black/55">
        Menampilkan {awal}–{akhir} dari {total} laporan
      </p>
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <button type="button" onClick={() => onPilih(halaman - 1)} disabled={halaman <= 1}
                aria-label="Halaman sebelumnya" className={kelasTombol}>
          ← Sebelumnya
        </button>
        <div className="hidden items-center gap-1 px-1 min-[430px]:flex" aria-hidden={false}>
          {nomor.map((item, idx) =>
            item === "..." ? (
              <span key={`ellipsis-${idx}`} className="select-none px-1.5 text-[13px] text-black/40">
                …
              </span>
            ) : item === halaman ? (
              <span key={item} aria-current="page"
                    className="grid min-h-[34px] min-w-[34px] place-items-center rounded-lg bg-black/80 px-2 py-1.5 text-xs sm:text-sm font-bold text-white shadow-xs">
                {item}
              </span>
            ) : (
              <button key={item} type="button" onClick={() => onPilih(item)}
                      aria-label={`Halaman ${item}`} className={kelasTombol}>
                {item}
              </button>
            ),
          )}
        </div>
        <button type="button" onClick={() => onPilih(halaman + 1)} disabled={halaman >= totalHalaman}
                aria-label="Halaman selanjutnya" className={kelasTombol}>
          Selanjutnya →
        </button>
      </div>
    </nav>
  );
}

/** Satu segmen saklar mode tampilan (daftar/kartu). */function TombolTampilan({ aktif, label, onClick, children }: {
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
