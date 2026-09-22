"use client";

import { useCallback, useEffect, useState } from "react";
import { gunakanPanggung } from "@/hooks/gunakan-panggung";
import { gunakanParallax } from "@/hooks/gunakan-parallax";
import { gunakanSegarOtomatis } from "@/hooks/gunakan-segar-otomatis";
import { BAHASA, type Bahasa } from "@/lib/bahasa";



import { Korsel } from "./korsel";
import { Peta } from "./peta";
import { PanelProvinsi } from "./panel-provinsi";
import { PopupPeta } from "./popup-peta";
import { RincianLaporan } from "./rincian-laporan";
import { TUTUP_OVERLAY } from "@/lib/peristiwa-popup";

import type { Berita } from "@/lib/events";
import type { Statistik as DataStatistik } from "@/lib/statistik";
import type { ProvinsiTeratas } from "@/lib/wms";

type Props = {
  /** Sepuluh kurasi untuk korsel — urutan campuran terbaru + komentar. */
  berita: Berita[];
  /** Arsip lengkap untuk peta + pop-up wilayah. Tanpa ini keduanya hanya
   *  melihat 10 kurasi korsel (laporan ke-11 tak berpin dan tak terdaftar). */
  semuaBerita?: Berita[];
  jumlahLaporan: Record<string, number>;
  tigaTeratas: ProvinsiTeratas[];
  statistik: DataStatistik[];
  kejadianAwal?: Berita | null;
  bahasa?: Bahasa;
};

export function HalamanFire({
  berita,
  semuaBerita,
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
  // Data halaman menyegar sendiri (tab kembali terlihat + tiap 5 menit) —
  // pengunjung tak perlu hard reload untuk melihat kejadian terbaru dari CMS.
  gunakanSegarOtomatis();
  // Pop-up mana pun yang terbuka menghentikan guliran halaman di belakangnya.
  gunakanParallax(sorot !== null || wilayah !== null);

  // Daftar untuk peta + pop-up: arsip lengkap bila disediakan halaman,
  // kalau tidak ya 10 kurasi (pop-up permalink lama tetap jalan).
  const daftarPeta = semuaBerita ?? berita;

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

  const indeksSorot = sorot ? daftarPeta.findIndex((b) => b.id === sorot.id) : -1;
  const adaSebelumnya = indeksSorot > 0;
  const adaBerikutnya = indeksSorot >= 0 && indeksSorot < daftarPeta.length - 1;
  const keSebelumnya = adaSebelumnya ? () => bukaRincian(daftarPeta[indeksSorot - 1]) : undefined;
  const keBerikutnya = adaBerikutnya ? () => bukaRincian(daftarPeta[indeksSorot + 1]) : undefined;

  // Sinkronkan pop-up saat pengunjung menekan tombol Back / Forward di peramban
  useEffect(() => {
    const saatPopState = () => {
      const path = window.location.pathname;
      const pola = new RegExp(`^/(?:${BAHASA.join("|")})/fire/([^/]+)$`);
      const cocokan = path.match(pola);
      if (cocokan && cocokan[1]) {
        const slug = decodeURIComponent(cocokan[1]);
        const ketemu = daftarPeta.find((b) => b.slug === slug);
        if (ketemu) {
          setSorot(ketemu);
          return;
        }
      }
      setSorot(null);
    };

    window.addEventListener("popstate", saatPopState);
    return () => window.removeEventListener("popstate", saatPopState);
  }, [daftarPeta]);

  // Bilah navigasi menuju beranda/bagian halaman: tutup pop-up apa pun yang
  // sedang terbuka. Tidak bisa disandarkan pada perubahan rute — lihat
  // lib/peristiwa-popup.ts untuk sebabnya.
  useEffect(() => {
    const tutupSemua = () => {
      setWilayah(null);
      // tutupRincian, bukan setSorot(null): ia juga mengembalikan URL dari
      // /xx/fire/<slug> ke beranda. Tanpa itu pop-up tertutup tapi bilah
      // alamat tetap menunjuk kejadian yang sudah tidak tampak.
      tutupRincian();
    };
    window.addEventListener(TUTUP_OVERLAY, tutupSemua);
    return () => window.removeEventListener(TUTUP_OVERLAY, tutupSemua);
  }, [tutupRincian]);

  return (
    <>
      <Korsel berita={berita} statistik={statistik} bahasa={bahasa} onBuka={(i) => berita[i] && bukaRincian(berita[i])} />

      {/* Layar 2 — peta sebaran & forecasting. Menggulir naik menutupi hero. */}
      <section
        id="peta"
        aria-label="Peta sebaran"
        data-kabur-tepi
        className="tepi-lunak relative z-[2] flex h-[100svh] min-h-[100svh] w-full flex-col justify-center overflow-hidden"
      >
        {/* Peta forecasting Windy AQI + poligon administratif fullscreen */}
        <div className="kabur-tepi pointer-events-none" aria-hidden="true" />
        <div className="absolute inset-0 h-full w-full">
          <Peta
            jumlahLaporan={jumlahLaporan}
            berita={daftarPeta}
            onPilihWilayah={(nama, pulau, asal) => setWilayah({ nama, pulau, asal })}
            onBukaRincian={bukaRincian}
          />
        </div>

        {/* Pencarian + tiga teratas melayang di bagian atas layar (khusus mobile, di desktop disembunyikan) */}
        <div className="pointer-events-none absolute inset-x-0 top-[128px] z-[20] flex justify-center px-4 md:hidden panggung:hidden">
          <div className="pointer-events-auto w-full max-w-[580px]">
            <PanelProvinsi
              teratas={tigaTeratas}
              onPilihWilayah={(nama, pulau, asal) => setWilayah({ nama, pulau, asal })}
            />
          </div>
        </div>
      </section>

      {sorot !== null && (
        <RincianLaporan
          berita={sorot}
          bahasa={bahasa}
          onTutup={tutupRincian}
          onSebelumnya={keSebelumnya}
          onBerikutnya={keBerikutnya}
          adaSebelumnya={adaSebelumnya}
          adaBerikutnya={adaBerikutnya}
          indeksAktif={indeksSorot >= 0 ? indeksSorot : undefined}
          totalKejadian={daftarPeta.length}
        />
      )}

      {wilayah && (
        <PopupPeta
          nama={wilayah.nama}
          pulau={wilayah.pulau}
          jumlah={jumlahLaporan[wilayah.nama] ?? null}
          asal={wilayah.asal}
          berita={daftarPeta}
          jumlahLaporan={jumlahLaporan}
          onBukaRincian={(i) => {
            const ketemu = daftarPeta[i];
            if (ketemu) bukaRincian(ketemu);
          }}
          onTutup={() => setWilayah(null)}
        />
      )}
    </>
  );
}