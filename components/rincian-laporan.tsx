"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { gunakanKomentar } from "@/hooks/gunakan-komentar";
import { useKurangiGerak, usePonsel } from "@/hooks/use-media-query";
import type { Bahasa } from "@/lib/bahasa";
import type { Berita } from "@/lib/events";
import { UlasanKomentar, FormulirKomentar } from "./kolom-komentar";
import { SliderRincian } from "./slider-rincian";

export type RincianNavProps = {
  onSebelumnya?: () => void;
  onBerikutnya?: () => void;
  adaSebelumnya?: boolean;
  adaBerikutnya?: boolean;
  indeksAktif?: number;
  totalKejadian?: number;
};

/** Pop-up rincian laporan, dengan kolom komentar di rel kanan dan tombol bagikan. */
export function RincianLaporan({
  berita,
  bahasa = "id",
  onTutup,
  gelap = false,
  onSebelumnya,
  onBerikutnya,
  adaSebelumnya = false,
  adaBerikutnya = false,
  indeksAktif,
  totalKejadian,
}: {
  berita: Berita;
  bahasa?: Bahasa;
  onTutup: () => void;
  /** true = rel kanan abu gelap (#1e1e1e) senada konsol /peta. Bawaan false
   *  supaya beranda dan /fire tetap putih. */
  gelap?: boolean;
} & RincianNavProps) {
  const kurangiGerak = useKurangiGerak();
  // Di ponsel komentar pindah dari rel ke lembar bawah: tombol komentar di
  // bilah atas membukanya setinggi ±70% layar (komentar + kolom kirim).
  const ponsel = usePonsel();
  const [sheetKomentar, setSheetKomentar] = useState(false);
  // Kolom kirim TIDAK terbuka bawaannya — lembar komentar hanya daftar, plus
  // baris pemicu. Formulirnya muncul saat pemicu ditekan atau saat membalas,
  // dan menutup kembali setelah terkirim.
  const [formKomentar, setFormKomentar] = useState(false);
  const [toastTersalin, setToastTersalin] = useState(false);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Pop-up ini di-unmount induknya begitu onTutup dipanggil, jadi animasi
  // keluar mustahil lewat CSS saja. Satu tanda `keluar` menahannya satu
  // animasi lebih lama, lalu animationend yang memanggil onTutup sungguhan —
  // tanpa timer yang harus disamakan manual dengan durasi di CSS.
  const [keluar, setKeluar] = useState(false);
  const mintaTutup = useCallback(() => {
    if (kurangiGerak) { onTutup(); return; }
    setKeluar(true);
  }, [kurangiGerak, onTutup]);

  const {
    daftar, memuat, mengirim, galat,
    nama, setNama, email, setEmail, anonim, setAnonim,
    isi, setIsi, website, setWebsite,
    balasKe, balasNama, batalBalas, mulaiBalas,
    tampilkanBalasan, alihkanBalasan, sebutanDari, isiTanpaSebutan,
    kirim, ketikRef, captchaRef,
  } = gunakanKomentar(berita.id);

  // Bersihkan timeout saat komponen dibongkar
  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  // Tutup dialog saat tombol Escape ditekan, navigasi kejadian dengan PageUp/PageDown, [, ], atau panah
  useEffect(() => {
    const saatTombol = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        // Lembar komentar dulu yang ditutup; modal tetap terbuka.
        if (sheetKomentar) {
          setSheetKomentar(false);
          return;
        }
        mintaTutup();
      } else if (e.key === "PageUp" || e.key === "[") {
        if (adaSebelumnya && onSebelumnya) {
          e.preventDefault();
          onSebelumnya();
        }
      } else if (e.key === "PageDown" || e.key === "]") {
        if (adaBerikutnya && onBerikutnya) {
          e.preventDefault();
          onBerikutnya();
        }
      } else if (e.key === "ArrowLeft" && (berita.media.length <= 1 || e.shiftKey)) {
        if (adaSebelumnya && onSebelumnya) {
          e.preventDefault();
          onSebelumnya();
        }
      } else if (e.key === "ArrowRight" && (berita.media.length <= 1 || e.shiftKey)) {
        if (adaBerikutnya && onBerikutnya) {
          e.preventDefault();
          onBerikutnya();
        }
      }
    };
    window.addEventListener("keydown", saatTombol, true);
    return () => window.removeEventListener("keydown", saatTombol, true);
  }, [mintaTutup, sheetKomentar, adaSebelumnya, onSebelumnya, adaBerikutnya, onBerikutnya, berita.media.length]);

  async function bagikan() {
    const tautan = typeof window !== "undefined"
      ? `${window.location.origin}/${bahasa}/fire/${berita.slug ?? berita.id}`
      : "";
    if (!tautan) return;

    // Pada peramban seluler (mobile), buka sheet berbagi bawaan jika tersedia.
    // Hanya kirim `title` dan `url` (tanpa `text`) agar sistem operasi tidak
    // menggabungkan deskripsi ke dalam string URL.
    const isMobile =
      typeof navigator !== "undefined" &&
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (isMobile && typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: berita.judul,
          url: tautan,
        });
        return;
      } catch (e: unknown) {
        if (e instanceof Error && e.name === "AbortError") return;
      }
    }

    // Di desktop atau fallback: salin tautan murni ke clipboard
    try {
      await navigator.clipboard.writeText(tautan);
      setToastTersalin(true);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setToastTersalin(false), 2500);
    } catch {
      // Fallback jika izin clipboard diblokir
    }
  }

  return (
    /* data-lenis-prevent: Lenis yang dihentikan selama pop-up terbuka tetap
       menelan roda dengan preventDefault; satu atribut di akar ini
       mengecualikan seluruh panel — rel kanan dan badan komentarnya — dari
       penangkapan itu, jadi keduanya bisa menggulir secara native. */
    <div className={`${gelap ? "rincian rincian--gelap" : "rincian"}${keluar ? " rincian--keluar" : ""} cursor-pointer`} data-lenis-prevent
         onClick={(e) => { if (e.target === e.currentTarget) mintaTutup(); }}
         /* animationend menggelembung dari anak (slider, lembar komentar);
            currentTarget menyaring supaya hanya animasi overlay ini yang
            menutup. Animasi masuk lolos karena `keluar` masih false. */
         onAnimationEnd={(e) => { if (keluar && e.target === e.currentTarget) onTutup(); }}>
      <div role="dialog" aria-modal="true" aria-label="Rincian laporan karhutla" className="rincian__panel cursor-default">
        {toastTersalin && (
          <div role="status" className="rincian__toast">
            {bahasa === "en" ? "Link copied to clipboard" : "Tautan disalin ke papan klip"}
          </div>
        )}

        <div className={`rincian__media kartu-bingkai ${
          berita.vertikal ? "rincian__media--tegak" : "rincian__media--lanskap"
        }`}>
          {berita.media.length > 0 ? (
            <SliderRincian
              key={berita.id}
              media={berita.media}
              poster={berita.poster} label={berita.alt} kurangiGerak={kurangiGerak} />
          ) : (
            // Tanpa media apa pun: tidak menampilkan foto dummy — kotak
            // medianya memuat petunjuk lokasi saja.
            <div className={`flex h-full min-h-[140px] items-center justify-center ${gelap ? "bg-[linear-gradient(150deg,#18181b,#27272a)]" : "bg-[linear-gradient(150deg,#eef1f4,#d7dee4)]"}`}>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${gelap ? "bg-white/10 text-white/60" : "bg-white/70 text-black/45"}`}>
                {berita.lokasi || "Belum ada foto"}
              </span>
            </div>
          )}
        </div>

        <div className="rincian__rel" data-lenis-prevent>
          <div className="rincian__kepala">
            <p className="rincian__tanggal">{berita.tanggal}</p>

            {/* Komentar, bagikan, tutup — satu baris dengan tanggal, bukan
                melayang di atas media. */}
            <div className="rincian__aksi">
              {/* Tombol komentar — hanya ponsel; di desktop komentarnya sudah
                  inline di rel kanan, tombol ini tak ada gunanya. Lencana jumlah
                  memberi tahu ada berapa komentar tanpa membuka lembarannya. */}
              {ponsel && (
                <button
                  type="button"
                  aria-label="Buka komentar"
                  title="Buka komentar"
                  onClick={() => setSheetKomentar(true)}
                  className="rincian__komentar-tombol cursor-pointer"
                >
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8Z" />
                  </svg>
                  {daftar.length > 0 && (
                    <span className="rincian__komentar-jumlah" aria-hidden="true">
                      {daftar.length > 99 ? "99+" : daftar.length}
                    </span>
                  )}
                </button>
              )}

              <button
                type="button"
                aria-label={bahasa === "en" ? "Share incident" : "Bagikan kejadian"}
                title={bahasa === "en" ? "Share incident" : "Bagikan kejadian"}
                onClick={bagikan}
                className="rincian__bagikan cursor-pointer"
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
              </button>

              <button type="button" aria-label="Tutup rincian" onClick={mintaTutup} className="rincian__tutup cursor-pointer">
                <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
          </div>

          <div className="rincian__badan" data-lenis-prevent>
            {/* Kapsi: judul, deskripsi, dan lokasi. Pulau dan tanggal sudah
                ditampilkan di kepala pop-up; tidak perlu digandakan. */}
            <div className="rincian__kapsi">
              <div className="rincian__kapsi-isi">
                <p className="rincian__judul">{berita.judul}</p>
                {berita.deskripsi && (
                  <p className="rincian__desc">{berita.deskripsi}</p>
                )}
                {berita.lokasi && (
                  <div className="rincian__data">
                    <div>
                      <p className="rincian__label">Lokasi</p>
                      <p className="rincian__nilai">{berita.lokasi}</p>
                      {/* Titik koordinat menyertai nama lokasi — buktinya bisa
                          diperiksa silang (tempel ke peta), dan pola galat
                          "S tertinggal ketik" terlihat langsung dari tandanya. */}
                      <a
                        href={`https://www.google.com/maps?q=${berita.lat},${berita.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rincian__koordinat"
                        title="Buka titik di Google Maps"
                      >
                        {berita.lat.toFixed(6)}, {berita.lng.toFixed(6)} ↗
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Kolom komentar: daftar di badan yang bergulir, kolom kirim di
                bawahnya dipatok di dasar rel — sama seperti pada proyek
                Pasopati. Di ponsel keduanya pindah ke lembar bawah (lihat
                tombol .rincian__komentar-tombol dan lembar di bawah). */}
            {!ponsel && (
              <UlasanKomentar
                daftar={daftar} memuat={memuat} galat={galat}
                tampilkanBalasan={tampilkanBalasan} alihkanBalasan={alihkanBalasan}
                mulaiBalas={mulaiBalas} sebutanDari={sebutanDari} isiTanpaSebutan={isiTanpaSebutan}
              />
            )}
          </div>

          {!ponsel && (
            <FormulirKomentar
              mengirim={mengirim} galat={galat} nama={nama} setNama={setNama}
              email={email} setEmail={setEmail}
              anonim={anonim} setAnonim={setAnonim}
              isi={isi} setIsi={setIsi}
              website={website} setWebsite={setWebsite}
              balasKe={balasKe} balasNama={balasNama} batalBalas={batalBalas}
              kirim={kirim} ketikRef={ketikRef} captchaRef={captchaRef}
            />
          )}
        </div>

      </div>

      {/* Indikator nomor urut kejadian di desktop */}
      {indeksAktif !== undefined && totalKejadian && (
        <div aria-hidden="true" className="rincian__indeks-desktop">
          {bahasa === "en" ? "Incident" : "Kejadian"} {indeksAktif + 1} / {totalKejadian}
        </div>
      )}

      {/* Tombol navigasi floating kejadian sebelumnya / berikutnya di Desktop */}
      {adaSebelumnya && onSebelumnya && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onSebelumnya(); }}
          aria-label={bahasa === "en" ? "Previous incident" : "Kejadian sebelumnya"}
          title={bahasa === "en" ? "Previous incident" : "Kejadian sebelumnya"}
          className="rincian__nav-tombol rincian__nav-tombol--kiri cursor-pointer"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="size-6">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
      )}

      {adaBerikutnya && onBerikutnya && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onBerikutnya(); }}
          aria-label={bahasa === "en" ? "Next incident" : "Kejadian berikutnya"}
          title={bahasa === "en" ? "Next incident" : "Kejadian berikutnya"}
          className="rincian__nav-tombol rincian__nav-tombol--kanan cursor-pointer"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="size-6">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      )}

      {/* Lembar bawah komentar (ponsel): daftar komentar bergulir di atas,
          kolom kirim lengkap dipatung di dasarnya — tinggi ±70% layar.
          FormulirKomentar pakai mode tanpaSheet karena lembar inilah wadahnya. */}
      {ponsel && sheetKomentar && (
        <div
          className="rincian__sheet cursor-pointer"
          role="dialog"
          aria-modal="true"
          aria-label="Komentar laporan"
          onClick={(e) => { if (e.target === e.currentTarget) setSheetKomentar(false); }}
        >
          <div className="rincian__sheet-panel rincian__sheet-panel--komentar cursor-default">
            <div className="rincian__sheet-kepala">
              <p className="rincian__sheet-judul">
                {bahasa === "en" ? "Comments" : "Komentar"}
                {daftar.length > 0 && ` (${daftar.length})`}
              </p>
              <button
                type="button"
                className="rincian__sheet-tutup cursor-pointer"
                aria-label="Tutup komentar"
                onClick={() => setSheetKomentar(false)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"
                     strokeWidth="2" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>

            <div className="rincian__sheet-isi" data-lenis-prevent>
              <UlasanKomentar
                daftar={daftar} memuat={memuat} galat={galat}
                tampilkanBalasan={tampilkanBalasan} alihkanBalasan={alihkanBalasan}
                mulaiBalas={mulaiBalas} sebutanDari={sebutanDari} isiTanpaSebutan={isiTanpaSebutan}
              />
            </div>

            {/* Dasar lembar: tombol pemicu sederhana untuk membuka formulir. */}
            {formKomentar || balasKe !== null ? (
              <FormulirKomentar
                mengirim={mengirim} galat={galat} nama={nama} setNama={setNama}
                email={email} setEmail={setEmail}
                anonim={anonim} setAnonim={setAnonim}
                isi={isi} setIsi={setIsi}
                website={website} setWebsite={setWebsite}
                balasKe={balasKe} balasNama={balasNama} batalBalas={batalBalas}
                kirim={kirim} ketikRef={ketikRef} captchaRef={captchaRef}
                  tutup={() => {
                  setFormKomentar(false);
                  if (balasKe !== null) batalBalas();
                }}
                tanpaSheet
              />
            ) : (
              <button
                type="button"
                aria-expanded={false}
                aria-label={bahasa === "en" ? "Add comment" : "Tambahkan komentar"}
                className="rincian__pemicu cursor-pointer"
                onClick={() => setFormKomentar(true)}
              >
                {bahasa === "en" ? "Add comment…" : "Tambahkan komentar…"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
