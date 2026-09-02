"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { gunakanPanggung } from "@/hooks/gunakan-panggung";
import { gunakanParallax } from "@/hooks/gunakan-parallax";
import { gunakanKomentar } from "@/hooks/gunakan-komentar";
import { useKurangiGerak } from "@/hooks/gunakan-korsel";
import { BAHASA, type Bahasa } from "@/lib/bahasa";



import { Korsel } from "./korsel";
import { Peta } from "./peta";
import { PanelProvinsi } from "./panel-provinsi";
import { PopupPeta } from "./popup-peta";
import { UlasanKomentar, FormulirKomentar } from "./kolom-komentar";
import { SliderRincian } from "./slider-rincian";

import type { Berita } from "@/lib/events";
import type { Statistik as DataStatistik } from "@/lib/statistik";
import type { ProvinsiTeratas } from "@/lib/wms";

type Props = {
  berita: Berita[];
  jumlahLaporan: Record<string, number>;
  tigaTeratas: ProvinsiTeratas[];
  statistik: DataStatistik[];
  kejadianAwal?: Berita | null;
  bahasa?: Bahasa;
};

export function HalamanFire({
  berita,
  jumlahLaporan,
  tigaTeratas,
  statistik,
  kejadianAwal,
  bahasa = "id",
}: Props) {
  // Berita yang pop-upnya terbuka, atau null.
  const [sorot, setSorot] = useState<Berita | null>(kejadianAwal ?? null);
  const [wilayah, setWilayah] = useState<
    { nama: string; pulau: string | null; asal: { x: number; y: number } } | null
  >(null);


  gunakanPanggung();
  // Pop-up mana pun yang terbuka menghentikan guliran halaman di belakangnya.
  gunakanParallax(sorot !== null || wilayah !== null);

  const bukaRincian = useCallback(
    (b: Berita) => {
      setSorot(b);
      if (typeof window !== "undefined") {
        const pathTujuan = b.slug ? `/${bahasa}/fire/${b.slug}` : `/${bahasa}`;
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
      const pathBeranda = `/${bahasa}`;
      if (window.location.pathname !== pathBeranda) {
        window.history.pushState(null, "", pathBeranda);
      }
    }
  }, [bahasa]);

  // Sinkronkan pop-up saat pengunjung menekan tombol Back / Forward di peramban
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

  return (
    <>
      <Korsel berita={berita} statistik={statistik} onBuka={(i) => berita[i] && bukaRincian(berita[i])} />

      {/* Layar 2 — peta sebaran. Menggulir naik menutupi hero. */}
      <section
        id="peta"
        aria-label="Peta sebaran"
        data-kabur-tepi
        className="tepi-lunak relative z-[2] flex min-h-[100svh] flex-col justify-center overflow-hidden
                   px-[var(--pias)] pt-[calc(4rem+clamp(32px,8vw,56px))] pb-[clamp(32px,8vw,56px)]
                   pendek:z-auto pendek:min-h-0
                   panggung:block panggung:h-screen panggung:min-h-0 panggung:relative panggung:z-[2] panggung:p-0"
      >
        {/* Dasar section: foto latar layar, lalu gradasi merah di atasnya.
            Yang tembus pandang adalah wadah Leaflet-nya (.leaflet-container),
            bukan sectionnya — jadi peta tergambar di atas kedua lapisan ini
            tanpa alas abu bawaan Leaflet. */}
        <img src="/assets/img/bg-karhutla.jpg" alt="" aria-hidden="true"
             className="absolute inset-0 h-full w-full object-cover" />
        <div className="kabur-tepi" aria-hidden="true" />
        <div aria-hidden="true" className="kabut-api absolute inset-0" />

        <div data-kanvas
             className="relative mx-auto w-full max-w-[940px]
                        panggung:absolute panggung:top-1/2 panggung:left-1/2 panggung:mx-0
                        panggung:mt-[-540px] panggung:ml-[-960px] panggung:h-[1080px]
                        panggung:w-[1920px] panggung:max-w-none panggung:origin-center
                        panggung:scale-[var(--skala,1)] panggung:overflow-hidden">
          {/* Geometri persis desain di panggung; rasio 2.5 di mode aliran. */}
          <div className="relative isolate aspect-[2.5] w-full
                          panggung:absolute panggung:top-[280.4px] panggung:left-[193.1px]
                          panggung:aspect-auto panggung:h-[575.8px] panggung:w-[1533.8px]">
            <Peta
              jumlahLaporan={jumlahLaporan}
              onPilihWilayah={(nama, pulau, asal) => setWilayah({ nama, pulau, asal })}
            />
          </div>
        </div>

        {/* Pencarian + tiga teratas: pengganti mode aliran untuk menekan
            provinsi langsung di peta, yang di layar sempit terlalu kecil. */}
        <PanelProvinsi
          teratas={tigaTeratas}
          onPilihWilayah={(nama, pulau, asal) => setWilayah({ nama, pulau, asal })}
        />
      </section>

      {sorot !== null && (
        <Rincian berita={sorot} bahasa={bahasa} onTutup={tutupRincian} />
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
            if (berita[i]) bukaRincian(berita[i]);
          }}
          onTutup={() => setWilayah(null)}
        />
      )}
    </>
  );
}

/** Pop-up rincian laporan, dengan kolom komentar di rel kanan dan tombol bagikan. */
function Rincian({
  berita,
  bahasa = "id",
  onTutup,
}: {
  berita: Berita;
  bahasa?: Bahasa;
  onTutup: () => void;
}) {
  const kurangiGerak = useKurangiGerak();
  const [toastTersalin, setToastTersalin] = useState(false);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

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

  // Tutup dialog saat tombol Escape ditekan (capture phase agar tidak menutup popup peta di bawahnya)
  useEffect(() => {
    const saatTombol = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        onTutup();
      }
    };
    window.addEventListener("keydown", saatTombol, true);
    return () => window.removeEventListener("keydown", saatTombol, true);
  }, [onTutup]);

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
    <div className="rincian" onClick={(e) => { if (e.target === e.currentTarget) onTutup(); }}>
      <div role="dialog" aria-modal="true" aria-label="Rincian laporan karhutla" className="rincian__panel">
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
            <div className="flex h-full min-h-[140px] items-center justify-center bg-[linear-gradient(150deg,#eef1f4,#d7dee4)]">
              <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-black/45">
                {berita.lokasi || "Belum ada foto"}
              </span>
            </div>
          )}
        </div>

        <div className="rincian__rel">
          <div className="rincian__kepala">
            {/* Hanya thumbnail asli kejadian ini. `gambar` punya cadangan satu foto
                bawaan yang sama untuk semua kejadian tanpa thumbnail, jadi
                memakainya di sini membuat keping ini menampilkan gambar yang
                tidak ada hubungannya dengan media yang sedang dibuka. Tanpa
                thumbnail, huruf depan nama pulau saja — sama seperti keping
                komentar. */}
            {berita.poster ? (
              <img className="rincian__keping" src={berita.poster} alt="" aria-hidden="true" />
            ) : (
              <span className="rincian__inisial" aria-hidden="true">{(berita.pulau ?? "I").charAt(0)}</span>
            )}
            <div className="rincian__kapsi-isi">
              <p className="rincian__tanggal">{berita.tanggal}</p>
            </div>
          </div>

          <div className="rincian__badan">
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
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Kolom komentar: daftar di badan yang bergulir, kolom kirim di
                bawahnya dipatok di dasar rel — sama seperti pada proyek
                Pasopati. */}
            <UlasanKomentar
              daftar={daftar} memuat={memuat} galat={galat}
              tampilkanBalasan={tampilkanBalasan} alihkanBalasan={alihkanBalasan}
              mulaiBalas={mulaiBalas} sebutanDari={sebutanDari} isiTanpaSebutan={isiTanpaSebutan}
            />
          </div>

          <FormulirKomentar
            mengirim={mengirim} nama={nama} setNama={setNama}
            email={email} setEmail={setEmail}
            anonim={anonim} setAnonim={setAnonim}
            isi={isi} setIsi={setIsi}
            website={website} setWebsite={setWebsite}
            balasKe={balasKe} balasNama={balasNama} batalBalas={batalBalas}
            kirim={kirim} ketikRef={ketikRef} captchaRef={captchaRef}
          />
        </div>

        <button
          type="button"
          aria-label={bahasa === "en" ? "Share incident" : "Bagikan kejadian"}
          title={bahasa === "en" ? "Share incident" : "Bagikan kejadian"}
          onClick={bagikan}
          className="rincian__bagikan"
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

        <button type="button" aria-label="Tutup rincian" onClick={onTutup} className="rincian__tutup">
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
