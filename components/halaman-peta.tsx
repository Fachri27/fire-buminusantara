"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Berita } from "@/lib/events";
import type { ProvinsiTeratas } from "@/lib/wms";
import { BAHASA, TEKS_PETA, type Bahasa } from "@/lib/bahasa";
import { gunakanParallax } from "@/hooks/gunakan-parallax";
import { TUTUP_OVERLAY } from "@/lib/peristiwa-popup";
import {
  inferPulau,
  namaProvinsiLokal,
  ringkasNamaProvinsi,
  PROVINSI_PETA_NAMA,
} from "@/lib/wilayah";
import { Peta } from "@/components/peta";
import { PopupPeta } from "@/components/popup-peta";
import { RincianLaporan } from "@/components/rincian-laporan";

/** Provinsi yang ditekan di peta atau di rel kiri — pop-up laporan provinsi
 *  ini tumbuh dari titik layar tempat ia ditekan. */
type WilayahDipilih = { nama: string; pulau: string | null; asal: { x: number; y: number } };

/** Hasil pencarian di rel kanan — dibatasi supaya tetap terpindai. */
const BATAS_CARI = 10;

/**
 * Konsol pantau karhutla — tiga kolom terkunci satu viewport.
 *
 * Kiri pencarian + daftar 34 provinsi + peringkat luas terbakar, tengah judul
 * + peta berbingkai (bukan selayar penuh), kanan kartu laporan terbaru.
 * Di layar panggung halaman tidak menggulir — rel-relnya menggulir
 * sendiri-sendiri; di bawah itu ia mengalir biasa: peta dulu, sisanya
 * menyusul.
 *
 * Satu klik pada laporan membuka pop-up rincian yang sama dengan beranda
 * (geser media, komentar, bagikan) — URL ikut berpindah ke /fire/<slug> dan
 * kembali ke /peta saat ditutup.
 */
export function HalamanPeta({
  berita,
  terbaru,
  populer,
  jumlahLaporan,
  teratas,
  bahasa,
}: {
  /** Arsip lengkap — pop-up wilayah dan pencarian. */
  berita: Berita[];
  /** Lima laporan terbaru — kelompok pertama rel kanan saat tidak mencari. */
  terbaru: Berita[];
  /** Lima laporan berkomentar terbanyak (di luar lima terbaru) — kelompok
   *  kedua rel kanan saat tidak mencari. */
  populer: Berita[];
  jumlahLaporan: Record<string, number>;
  teratas: ProvinsiTeratas[];
  bahasa: Bahasa;
}) {
  const teks = TEKS_PETA[bahasa];
  const [wilayah, setWilayah] = useState<WilayahDipilih | null>(null);
  // Laporan yang pop-up rinciannya terbuka, atau null — sama seperti beranda.
  const [sorot, setSorot] = useState<Berita | null>(null);
  const [cari, setCari] = useState("");
  // Daftar provinsi bisa dilipat supaya rel kiri tidak terlalu panjang ke bawah.
  const [provinsiBuka, setProvinsiBuka] = useState(true);
  // Kedua rel bisa dilipat seluruhnya supaya peta lebih lega — dibuka lagi
  // lewat tab di tepi bingkai peta. Peta mengikuti sendiri (ResizeObserver
  // bawaan MapLibre), tak perlu resize manual.
  const [kiriBuka, setKiriBuka] = useState(true);
  const [kananBuka, setKananBuka] = useState(true);
  // Jam konsol (WIB), disegarkan tiap setengah menit — teksnya berubah,
  // bukan animasi, jadi aman bagi pengurang gerak.
  const [kini, setKini] = useState("");

  useEffect(() => {
    const bacaJam = () =>
      setKini(
        new Intl.DateTimeFormat(bahasa === "en" ? "en-GB" : "id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Asia/Jakarta",
        }).format(new Date()),
      );
    bacaJam();
    const pengulang = setInterval(bacaJam, 30_000);
    return () => clearInterval(pengulang);
  }, [bahasa]);

  const kunci = ringkasNamaProvinsi(cari.trim());

  /* Provinsi terbanyak laporannya dulu, abjad sebagai penyeimbang —
     urutan yang sama dengan daftar pilihan di pop-up wilayah, supaya
     pengunjung tidak mempelajari dua urutan berbeda. */
  const daftarProvinsi = useMemo(() => {
    const semua = [...PROVINSI_PETA_NAMA].sort(
      (a, b) =>
        (jumlahLaporan[b] ?? 0) - (jumlahLaporan[a] ?? 0) ||
        a.localeCompare(b, "id"),
    );
    if (!kunci) return semua;
    return semua.filter((n) => ringkasNamaProvinsi(n).includes(kunci));
  }, [jumlahLaporan, kunci]);

  /* Rel kanan: tanpa kata kunci ia menampilkan dua kelompok (5 terbaru + 5
     terpopuler); saat mencari ia menyaring arsip lengkap. null = mode
     kelompok, array = hasil pencarian. */
  const laporanTampil = useMemo(() => {
    if (!kunci) return null;
    return berita
      .filter((b) =>
        [b.judul, b.lokasi, b.provinsi].some(
          (t) => t && ringkasNamaProvinsi(t).includes(kunci),
        ),
      )
      .slice(0, BATAS_CARI);
  }, [berita, kunci]);

  const total = berita.length;
  const satuan = (
    bahasa === "en" ? (total === 1 ? teks.terpantauSatu : teks.terpantau) : teks.terpantau
  ).toUpperCase();

  /* Pop-up tumbuh dari baris yang ditekan, sama seperti ia tumbuh dari
     provinsi yang ditekan di peta. */
  const pilihProvinsi = (nama: string, e: React.MouseEvent<HTMLElement>) => {
    const kotak = e.currentTarget.getBoundingClientRect();
    setWilayah({
      nama,
      pulau: inferPulau(nama),
      asal: { x: kotak.left + kotak.width / 2, y: kotak.top + kotak.height / 2 },
    });
  };

  // Pop-up rincian seperti beranda: URL ikut ke /fire/<slug>, kembali ke /peta
  // saat ditutup. Pop-up wilayah (kalau ada) tetap di bawahnya (z-46 > z-45).
  const bukaRincian = useCallback(
    (b: Berita) => {
      setSorot(b);
      if (typeof window !== "undefined") {
        const pathTujuan = b.slug ? `/${bahasa}/fire/${b.slug}` : `/${bahasa}/peta`;
        if (window.location.pathname !== pathTujuan) {
          window.history.pushState({ slug: b.slug }, "", pathTujuan);
        }
      }
    },
    [bahasa],
  );

  const tutupRincian = useCallback(() => {
    setSorot(null);
    if (typeof window !== "undefined") {
      const pathPeta = `/${bahasa}/peta`;
      if (window.location.pathname !== pathPeta) {
        window.history.pushState(null, "", pathPeta);
      }
    }
  }, [bahasa]);

  // Pop-up mana pun yang terbuka menghentikan guliran halaman di belakangnya.
  gunakanParallax(sorot !== null || wilayah !== null);

  // Sinkronkan pop-up saat pengunjung menekan tombol Back / Forward di peramban.
  useEffect(() => {
    const saatPopState = () => {
      const path = window.location.pathname;
      const pola = new RegExp(`^/(?:${BAHASA.join("|")})/fire/([^/]+)$`);
      const cocokan = path.match(pola);
      if (cocokan && cocokan[1]) {
        const slug = decodeURIComponent(cocokan[1]);
        const ketemu = berita.find((b) => b.slug === slug);
        if (ketemu) {
          setSorot(ketemu);
          return;
        }
      }
      setSorot(null);
    };

    window.addEventListener("popstate", saatPopState);
    return () => window.removeEventListener("popstate", saatPopState);
  }, [berita]);

  // Bilah navigasi: tutup pop-up apa pun yang sedang terbuka.
  useEffect(() => {
    const tutupSemua = () => {
      setWilayah(null);
      tutupRincian();
    };
    window.addEventListener(TUTUP_OVERLAY, tutupSemua);
    return () => window.removeEventListener(TUTUP_OVERLAY, tutupSemua);
  }, [tutupRincian]);

  return (
    <div className="bg-pantau-malam pt-16 text-pantau-tulang panggung:flex panggung:h-[100svh] panggung:flex-col panggung:overflow-hidden">
      <div
        className={`mx-auto flex w-full max-w-[1720px] flex-1 flex-col aliran:gap-3 aliran:px-3 aliran:pb-4 panggung:grid panggung:min-h-0 ${
          kiriBuka && kananBuka
            ? "panggung:grid-cols-[300px_minmax(0,1fr)_340px] xl:grid-cols-[320px_minmax(0,1fr)_360px]"
            : kiriBuka
              ? "panggung:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)]"
              : kananBuka
                ? "panggung:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_360px]"
                : "panggung:grid-cols-[minmax(0,1fr)]"
        }`}
      >
        {/* ── Rel kiri: cari + provinsi + peringkat ─────────────────── */}
        {kiriBuka && (
        <aside
          id="rel-kiri-pantau"
          data-lenis-prevent
          aria-label={teks.provinsi}
          className="pantau-rel min-h-0 border-white/10 bg-pantau-konsol p-4
                     aliran:rounded-2xl aliran:ring-1 aliran:ring-white/10
                     panggung:overflow-y-auto panggung:overscroll-contain panggung:border-r panggung:py-5"
        >
          <form role="search" onSubmit={(e) => e.preventDefault()} className="relative">
            <label htmlFor="cari-pantau" className="sr-only">
              {teks.cari}
            </label>
            <svg
              viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round"
              className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-pantau-abu"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.6-3.6" />
            </svg>
            <input
              id="cari-pantau" type="search" value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder={teks.cari} autoComplete="off"
              className="w-full rounded-xl bg-pantau-sumur py-3 pr-3.5 pl-11 text-sm text-pantau-tulang
                         ring-1 ring-white/10 outline-none placeholder:text-pantau-abu/70
                         focus-visible:ring-2 focus-visible:ring-pantau-bara
                         [&::-webkit-search-cancel-button]:hidden"
            />
          </form>

          <button
            type="button"
            onClick={() => setProvinsiBuka((b) => !b)}
            aria-expanded={provinsiBuka}
            aria-controls="daftar-provinsi-pantau"
            className="mt-5 flex w-full items-center justify-between gap-2 rounded-lg px-1 py-1 text-left
                       focus-visible:ring-2 focus-visible:ring-pantau-bara focus-visible:outline-none"
          >
            <span className="font-mono text-[11px] font-semibold tracking-[0.18em] text-pantau-abu uppercase">
              {teks.provinsi}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="font-mono text-[11px] text-pantau-abu/70">
                {kunci ? `${daftarProvinsi.length}/${PROVINSI_PETA_NAMA.length}` : PROVINSI_PETA_NAMA.length}
              </span>
              <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2"
                   strokeLinecap="round" strokeLinejoin="round"
                   className={`size-3.5 text-pantau-abu/70 transition-transform ${provinsiBuka ? "" : "-rotate-90"}`}>
                <path d="m6 9 6 6 6-6" />
              </svg>
            </span>
          </button>

          {provinsiBuka &&
            (daftarProvinsi.length > 0 ? (
            <ul id="daftar-provinsi-pantau" className="pantau-rel mt-1 max-h-[300px] overflow-y-auto overscroll-contain">
              {daftarProvinsi.map((nama) => {
                const n = jumlahLaporan[nama] ?? 0;
                const pulau = inferPulau(nama);
                return (
                  <li key={nama}>
                    <button
                      type="button" onClick={(e) => pilihProvinsi(nama, e)}
                      aria-label={`${nama}, ${n}`}
                      className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left
                                 transition-colors hover:bg-white/[0.06]
                                 focus-visible:ring-2 focus-visible:ring-pantau-bara focus-visible:outline-none"
                    >
                      {/* Titik bara menyala hanya yang laporannya ada — rel ini
                          dibaca sekilas seperti papan status. */}
                      <span
                        aria-hidden="true"
                        className={`size-1.5 shrink-0 rounded-full ${n > 0 ? "bg-pantau-bara" : "bg-white/15"}`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-pantau-tulang">
                          {nama}
                        </span>
                        {pulau && (
                          <span className="block truncate font-mono text-[10.5px] tracking-wider text-pantau-abu/80 uppercase">
                            {pulau}
                          </span>
                        )}
                      </span>
                      <span
                        className={`shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold ${
                          n > 0
                            ? "bg-pantau-bara/15 text-pantau-bara"
                            : "bg-white/[0.06] text-pantau-abu/70"
                        }`}
                      >
                        {n}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-2 rounded-xl bg-pantau-sumur px-3.5 py-4 text-[13px] leading-relaxed text-pantau-abu ring-1 ring-white/10">
              {teks.tidakCocok} {teks.cobaLain}
            </p>
            ))}

          {/* Peringkat luas terbakar dari model WMS — angkanya berurutan,
              jadi nomor peringkat di sini membawa informasi, bukan hiasan. */}
          {teratas.length > 0 && (
            <div className="mt-6 pb-2">
              <h2 className="font-mono text-[11px] font-semibold tracking-[0.18em] text-pantau-abu uppercase">
                {teks.terluas}
              </h2>
              <ol className="mt-2 overflow-hidden rounded-xl ring-1 ring-white/10">
                {teratas.map((p) => {
                  const nama = namaProvinsiLokal(p.nama);
                  return (
                    <li key={p.nama} className="border-b border-white/[0.07] bg-pantau-sumur last:border-0">
                      <button
                        type="button" onClick={(e) => pilihProvinsi(nama, e)}
                        className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors
                                   hover:bg-white/[0.04] focus-visible:ring-2 focus-visible:ring-pantau-bara
                                   focus-visible:ring-inset focus-visible:outline-none"
                      >
                        <span className="font-mono text-xs font-bold text-pantau-gambut">
                          {p.peringkat}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-semibold text-pantau-tulang">
                            {nama}
                          </span>
                          <span className="block truncate font-mono text-[10.5px] tracking-wider text-pantau-abu/80 uppercase">
                            {p.pulau}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </aside>
        )}

        {/* ── Tengah: judul di atas, peta berbingkai di bawahnya ───────
            Di aliran kolom ini naik paling atas: peta adalah pekerjaannya. */}
        <section id="peta" aria-label={teks.judulHalaman} className="flex min-h-0 flex-col px-1 aliran:order-first panggung:px-5 panggung:py-5">
          <div className="relative px-1 pt-1 pb-4">
            <div aria-hidden="true" className="pantau-titik pantau-titik--kanan hidden sm:block" />
            <h2 className="relative text-[clamp(19px,1.8vw,26px)] leading-[1.1] font-bold tracking-tight text-white">
              {teks.judulHalaman}
            </h2>
            <p className="relative mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11.5px] tracking-[0.14em] text-pantau-abu uppercase aliran:text-[10.5px]">
              <span className="titik-pantau" aria-hidden="true" />
              <span>
                {teks.langsung} · {kini ? `${kini} WIB` : "—"} · {total} {satuan}
              </span>
            </p>
          </div>

          <div className="relative h-[54svh] min-h-0 overflow-hidden rounded-2xl ring-1 ring-white/10 panggung:h-auto panggung:flex-1">
            <Peta
              jumlahLaporan={jumlahLaporan}
              onPilihWilayah={(nama, pulau, asal) => setWilayah({ nama, pulau, asal })}
              /* Bingkai tengah lebih sempit dari viewport — legenda yang selalu
                 terbuka menindih bilah waktu, jadi ia jadi cip yang dibuka
                 sendiri seperti di ponsel; pil alih mode pun rapat ke atas
                 bingkai, bukan melayang di tengah peta. Kamera awal langsung
                 memuat seluruh Nusantara. */
              legendaRingkas
              tombolRapat
              muatNusantara
            />
            {/* Tab lipat rel kiri/kanan di tepi bingkai — selalu terlihat,
                di mode aliran pun (relnya di bawah peta). Tengah vertikal
                bebas dari pil mode (atas), legenda & linimasa (bawah). */}
            <TabRel
              sisi="kiri"
              terbuka={kiriBuka}
              kontrol="rel-kiri-pantau"
              labelTutup={bahasa === "en" ? "Collapse province panel" : "Tutup panel provinsi"}
              labelBuka={bahasa === "en" ? "Open province panel" : "Buka panel provinsi"}
              onUbah={() => setKiriBuka((b) => !b)}
            />
            <TabRel
              sisi="kanan"
              terbuka={kananBuka}
              kontrol="rel-kanan-pantau"
              labelTutup={bahasa === "en" ? "Collapse report panel" : "Tutup panel laporan"}
              labelBuka={bahasa === "en" ? "Open report panel" : "Buka panel laporan"}
              onUbah={() => setKananBuka((b) => !b)}
            />
          </div>
        </section>

        {/* ── Rel kanan: laporan terbaru, tanggal–judul–gambar ─────── */}
        {kananBuka && (
        <aside
          id="rel-kanan-pantau"
          data-lenis-prevent
          aria-label={teks.terbaru}
          className="pantau-rel min-h-0 border-white/10 bg-pantau-konsol p-4 sm:p-5
                     aliran:rounded-2xl aliran:ring-1 aliran:ring-white/10
                     panggung:overflow-y-auto panggung:overscroll-contain panggung:border-l panggung:py-5"
        >
          <h2 className="sr-only">{teks.terbaru}</h2>
          {laporanTampil !== null ? (
            laporanTampil.length > 0 ? (
              <ul className="divide-y divide-white/10">
                {laporanTampil.map((b) => (
                  <li key={b.id} className="py-5 first:pt-0 last:pb-0">
                    <KartuLaporan b={b} bukaLabel={teks.bukaRincian} onBuka={() => bukaRincian(b)} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-xl bg-pantau-sumur px-3.5 py-4 text-[13px] leading-relaxed text-pantau-abu ring-1 ring-white/10">
                {teks.tidakCocok} {teks.cobaLain}
              </p>
            )
          ) : terbaru.length + populer.length > 0 ? (
            <>
              {terbaru.length > 0 && (
                <section aria-label={teks.terbaru}>
                  <h3 className="font-mono text-[11px] font-semibold tracking-[0.18em] text-pantau-abu uppercase">
                    {teks.terbaru}
                  </h3>
                  <ul className="mt-2 divide-y divide-white/10">
                    {terbaru.map((b) => (
                      <li key={b.id} className="py-5 first:pt-0 last:pb-0">
                        <KartuLaporan b={b} bukaLabel={teks.bukaRincian} onBuka={() => bukaRincian(b)} />
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {populer.length > 0 && (
                <section aria-label={teks.populer} className="mt-8 border-t border-white/10 pt-6">
                  <h3 className="font-mono text-[11px] font-semibold tracking-[0.18em] text-pantau-abu uppercase">
                    {teks.populer}
                  </h3>
                  <ul className="mt-2 divide-y divide-white/10">
                    {populer.map((b) => (
                      <li key={b.id} className="py-5 first:pt-0 last:pb-0">
                        <KartuLaporan b={b} bukaLabel={teks.bukaRincian} onBuka={() => bukaRincian(b)} />
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          ) : (
            <p className="rounded-xl bg-pantau-sumur px-3.5 py-4 text-[13px] leading-relaxed text-pantau-abu ring-1 ring-white/10">
              {teks.relKosong}
            </p>
          )}
        </aside>
        )}
      </div>

      {sorot !== null && (
        <RincianLaporan berita={sorot} bahasa={bahasa} onTutup={tutupRincian} />
      )}

      {wilayah && (
        <PopupPeta
          nama={wilayah.nama}
          pulau={wilayah.pulau}
          jumlah={jumlahLaporan[wilayah.nama] ?? null}
          asal={wilayah.asal}
          berita={berita}
          jumlahLaporan={jumlahLaporan}
          onBukaRincian={(i) => {
            const ketemu = berita[i];
            if (ketemu) bukaRincian(ketemu);
          }}
          onTutup={() => setWilayah(null)}
        />
      )}
    </div>
  );
}

/** Tab gagang di tepi bingkai peta untuk melipat/membuka satu rel. Panah
 *  menunjuk arah gerak relnya: ke tepi saat terbuka (klik = lipat), ke tengah
 *  saat terlipat (klik = buka). */
function TabRel({ sisi, terbuka, kontrol, labelTutup, labelBuka, onUbah }: {
  sisi: "kiri" | "kanan";
  terbuka: boolean;
  kontrol: string;
  labelTutup: string;
  labelBuka: string;
  onUbah: () => void;
}) {
  const label = terbuka ? labelTutup : labelBuka;
  // kiri terbuka → ‹ (lipat ke kiri); kiri tertutup → › (buka ke tengah).
  const keKiri = sisi === "kiri" ? terbuka : !terbuka;
  return (
    <button
      type="button"
      onClick={onUbah}
      aria-expanded={terbuka}
      aria-controls={kontrol}
      aria-label={label}
      title={label}
      className={`absolute top-1/2 z-[600] -translate-y-1/2 bg-black/70 py-3 text-white/70 ring-1 ring-white/20 backdrop-blur-md transition-colors
                  hover:bg-black hover:text-white focus-visible:ring-2 focus-visible:ring-pantau-bara focus-visible:outline-none ${
                    sisi === "kiri" ? "left-0 rounded-r-lg pr-1 pl-0.5" : "right-0 rounded-l-lg pr-0.5 pl-1"
                  }`}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4"
           strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
        <path d={keKiri ? "m14 6-6 6 6 6" : "m10 6 6 6-6 6"} />
      </svg>
    </button>
  );
}

/** Satu kartu rel kanan: tanggal–judul–media, plus titik galeri bila
 *  laporannya bermedia lebih dari satu (seperti TitikMedia beranda). Kartunya
 *  tumpukan grid satu sel: tombol dan titik menumpang di dalam gambar tanpa
 *  tombol di dalam tombol. */
function KartuLaporan({ b, bukaLabel, onBuka }: { b: Berita; bukaLabel: string; onBuka: () => void }) {
  const [indeks, setIndeks] = useState(0);
  const jumlah = b.media.length;
  // Galeri bisa menyusut saat data dimuat ulang; indeks yang tertinggal di
  // luar batas akan merender undefined.
  const kini = indeks < jumlah ? indeks : 0;
  const item = b.media[kini];
  const galeri = jumlah > 1;
  const adalahVideo = item?.jenis === "video";

  return (
    /* Tumpukan grid satu sel: tombol kartu dan titik galeri menempati sel yang
       sama sehingga titiknya menumpang di dalam gambar — tanpa tombol di dalam
       tombol. Gambar adalah anak terakhir tombol, jadi dasar kartu = dasar
       gambar dan titik selalu duduk di tepi bawah gambar. Celahnya
       pointer-events-none supaya klik di luar titik tetap membuka laporan. */
    <div className="grid">
      <button
        type="button" onClick={onBuka}
        title={bukaLabel} aria-label={`${b.judul} — ${bukaLabel}`}
        className="group col-start-1 row-start-1 block w-full text-left focus-visible:outline-none
                   focus-visible:ring-2 focus-visible:ring-pantau-bara focus-visible:ring-offset-2
                   focus-visible:ring-offset-pantau-konsol"
      >
        <p className="font-mono text-[11px] tracking-[0.08em] text-pantau-abu uppercase">
          {b.tanggal}
        </p>
        <p className="mt-1.5 text-[17px] leading-[1.25] font-bold tracking-tight text-white aliran:text-[15px]">
          {b.judul}
        </p>
        {/* Potret dikunci max-w-360: di rel 300px ia selebar rel, tapi dalam
            aliran selebar viewport kotak 3:4-nya meledak setinggi 1600px. */}
        <span className={`relative mt-3 block overflow-hidden bg-black ${b.vertikal ? "mx-auto aspect-[3/4] w-full max-w-[360px]" : "aspect-[16/10]"}`}>
          {item ? (
            item.jenis === "video" ? (
              <VideoKeping key={item.url} url={item.url} poster={item.poster ?? b.poster} label={b.judul} />
            ) : (
              <Keping key={item.url} berita={b} src={item.url} />
            )
          ) : (
            <Keping berita={b} />
          )}
          {adalahVideo && (
            <span aria-hidden="true" className="absolute right-2 bottom-2 flex items-center gap-1.5 rounded-full bg-black/70 py-1 pr-2.5 pl-2 font-mono text-[10px] tracking-wider text-white uppercase ring-1 ring-white/25 backdrop-blur-sm">
              <svg viewBox="0 0 24 24" fill="currentColor" className="size-2.5">
                <polygon points="6 4 20 12 6 20" strokeLinejoin="round" />
              </svg>
              Video
            </span>
          )}
        </span>
      </button>
      {galeri && (
        <div role="group" aria-label={`Media ${kini + 1}/${jumlah}`}
             className="pointer-events-none col-start-1 row-start-1 flex items-end justify-center pb-2">
          {/* Alas pil gelap: titik menumpang di atas foto yang kecerahannya tak
              menentu — tanpa ini yang tidak aktif tenggelam di foto terang.
              Di atas 6 media titik diganti bilah segmen kompak yang lebarnya
              dikunci, kalau tidak pilnya selebar gambar. */}
          <div className="pointer-events-none flex items-center gap-0.5 rounded-full bg-black/45 px-1.5 py-1 backdrop-blur-[2px]">
          {jumlah > 6 ? (
            <div className="flex w-36 items-center gap-1 px-1">
              {b.media.map((m, i) => (
                <button
                  key={`${m.jenis}-${m.url}`}
                  type="button"
                  onClick={() => setIndeks(i)}
                  aria-label={`Media ${i + 1}/${jumlah}`}
                  aria-current={i === kini}
                  className="pointer-events-auto flex h-[24px] min-w-0 flex-1 items-center
                             focus-visible:ring-2 focus-visible:ring-pantau-bara focus-visible:outline-none"
                >
                  <span
                    aria-hidden="true"
                    className={`h-[3px] w-full rounded-full transition-all ${
                      i === kini ? "bg-white" : "bg-white/40 hover:bg-white/70"
                    }`}
                  />
                </button>
              ))}
            </div>
          ) : (
          b.media.map((m, i) => (
            <button
              key={`${m.jenis}-${m.url}`}
              type="button"
              onClick={() => setIndeks(i)}
              aria-label={`Media ${i + 1}/${jumlah}`}
              aria-current={i === kini}
              className="pointer-events-auto flex min-h-[24px] min-w-[24px] items-center justify-center rounded-full
                         focus-visible:ring-2 focus-visible:ring-pantau-bara focus-visible:outline-none"
            >
              <span
                aria-hidden="true"
                className={`block size-[5px] rounded-full transition-all ${
                  i === kini ? "scale-110 bg-white" : "bg-white/55 hover:bg-white/85"
                }`}
              />
            </button>
          ))
          )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Pratinjau kartu rel kanan. Gambar yang lambat atau gagal tidak pernah
 *  memajang ikon rusak — pil lokasi di belakangnya yang tampil, dan gambar
 *  yang jadi memudar masuk di atasnya. */
function Keping({ berita: b, src }: { berita: Berita; src?: string }) {
  const [keadaan, setKeadaan] = useState<"memuat" | "ok" | "gagal">("memuat");
  const sumur = src ?? b.gambar ?? b.poster;

  /* Gambar dari cache bisa sudah `complete` sebelum hydration selesai —
     onLoad-nya sudah lewat dan tak menyala lagi, sehingga gambar terjebak
     opacity-0 selamanya. Ref ini mengejar ketertinggalannya saat pasang. */
  const pasangImg = useCallback((el: HTMLImageElement | null) => {
    if (el && el.complete) {
      setKeadaan(el.naturalWidth > 0 ? "ok" : "gagal");
    }
  }, []);

  /* Sengaja <img>, bukan next/image: gambar bisa berupa URL remote warisan
     (host dinamis per lingkungan) yang tak bisa didaftarkan ke
     remotePatterns statis. */
  return (
    <span className="absolute inset-0 flex items-center justify-center bg-pantau-sumur p-4">
      <span className="rounded-full bg-white/10 px-3 py-1 font-mono text-[11px] tracking-wider text-pantau-tulang/70 uppercase">
        {b.lokasi ?? b.provinsi ?? "Karhutla"}
      </span>
      {sumur && keadaan !== "gagal" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={pasangImg}
          src={sumur} alt="" loading="lazy"
          onLoad={() => setKeadaan("ok")}
          onError={() => setKeadaan("gagal")}
          className={`absolute inset-0 h-full w-full object-cover transition duration-500
                      group-hover:scale-[1.03] ${keadaan === "ok" ? "opacity-100" : "opacity-0"}`}
        />
      )}
    </span>
  );
}

/** Video kartu rel kanan — autoplay bisu berulang seperti korsel beranda
 *  (VideoKartu), tapi "aktif"-nya berarti kartu terlihat di layar: hanya yang
 *  terlihat yang diputar, sisanya dijeda, supaya 6 kartu tak mengunduh dan
 *  men-decode bersamaan. Tanpa suara dan tanpa kontrol (kartunya sendiri sudah
 *  tombol pembuka laporan); pengurang gerak berarti diam di poster. */
function VideoKeping({ url, poster, label }: { url: string; poster: string | null; label: string }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const terlihatRef = useRef(false);
  const [siap, setSiap] = useState(false);
  const [posterSiap, setPosterSiap] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Properti muted, bukan sekadar atribut — syarat autoplay sebagian peramban.
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

  /* play() saat kartu terlihat bisa ditolak kalau datanya belum siap — janjinya
     gagal dalam diam dan tak pernah dicoba lagi (kotak hitam). Begitu canplay,
     coba lagi selama kartunya masih terlihat. */
  const cobaPutar = useCallback((el: HTMLVideoElement) => {
    setSiap(true);
    if (terlihatRef.current) el.play().catch(() => {});
  }, []);

  /* Poster sebagai <img> sendiri di belakang video — pola beranda. Poster yang
     menumpang di atribut video ikut tak terlihat selama videonya opacity-0,
     sehingga penolakan putar (hemat daya) atau canplay yang macet berarti
     kotak hitam total. Dengan lapisan sendiri selalu ada bingkai terlihat. */
  const pasangPoster = useCallback((el: HTMLImageElement | null) => {
    if (el && el.complete) setPosterSiap(el.naturalWidth > 0);
  }, []);

  return (
    <span className="absolute inset-0 bg-black">
      {poster && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={pasangPoster}
          src={poster} alt="" aria-hidden="true" loading="lazy"
          onLoad={() => setPosterSiap(true)}
          onError={() => setPosterSiap(false)}
          className={`absolute inset-0 h-full w-full object-cover transition duration-500
                      group-hover:scale-[1.03] ${posterSiap ? "opacity-100" : "opacity-0"}`}
        />
      )}
      <video
        ref={ref}
        src={url}
        aria-label={label}
        muted
        playsInline
        loop
        preload="metadata"
        onCanPlay={(e) => cobaPutar(e.currentTarget)}
        className={`absolute inset-0 h-full w-full object-cover transition duration-500
                    group-hover:scale-[1.03] ${siap ? "opacity-100" : "opacity-0"}`}
      />
    </span>
  );
}
