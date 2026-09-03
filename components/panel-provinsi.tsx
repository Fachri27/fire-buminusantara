"use client";

import { useEffect, useMemo, useState } from "react";
import { jalurSvg, type Jalur } from "@/lib/geometri";
import { inferPulau, namaProvinsiLokal, ringkasNamaProvinsi, PROVINSI_PETA_NAMA } from "@/lib/wilayah";
import type { ProvinsiTeratas } from "@/lib/wms";

/** Jumlah saran pencarian yang ditampilkan sekaligus. */
const SARAN_MAKS = 6;

type Props = {
  teratas: ProvinsiTeratas[];
  onPilihWilayah: (nama: string, pulau: string | null, asal: { x: number; y: number }) => void;
};

/**
 * Pencarian provinsi + tiga provinsi dengan kebakaran terluas.
 *
 * Hanya mode aliran. Di panggung, peta selebar 1533px sudah menyediakan sasaran
 * tekan yang lapang untuk tiap provinsi; di ponsel seluruh Indonesia cuma
 * ~150px, jadi provinsi kecil praktis tak bisa ditekan — kolom pencarian inilah
 * jalan masuknya, dan daftar teratas memberi tiga yang paling perlu dilihat
 * tanpa harus dicari dulu.
 */
export function PanelProvinsi({ teratas, onPilihWilayah }: Props) {
  const [cari, setCari] = useState("");
  const [siluet, setSiluet] = useState<Record<string, Jalur>>({});
  // Di mobile panel ini melayang di atas peta; dulu selalu terbuka dan menutupi
  // peta. Sekarang tertutup secara bawaan — hanya sebuah tombol di sisi kanan —
  // dan isinya (pencarian + tiga teratas) baru muncul saat tombolnya diketuk.
  const [terbuka, setTerbuka] = useState(false);

  /* Siluet dibangun dari berkas yang sama dengan peta, jadi kunjungan kedua
     mengambilnya dari cache peramban. Gagal memuat bukan alasan menyembunyikan
     daftarnya: yang hilang hanya gambarnya. */
  useEffect(() => {
    let batal = false;
    fetch("/data/peta-provinsi.json")
      .then((r) => r.json())
      .then((data: { features: { properties: { nama: string }; geometry: { type: string; coordinates: unknown } }[] }) => {
        if (batal) return;
        const kumpulan: Record<string, Jalur> = {};
        for (const f of data.features ?? []) {
          const j = jalurSvg(f.geometry);
          if (j) kumpulan[f.properties.nama] = j;
        }
        setSiluet(kumpulan);
      })
      .catch(() => {});
    return () => { batal = true; };
  }, []);

  const hasil = useMemo(() => {
    const kunci = ringkasNamaProvinsi(cari);
    if (!kunci) return [];
    return PROVINSI_PETA_NAMA.filter((n) => ringkasNamaProvinsi(n).includes(kunci)).slice(0, SARAN_MAKS);
  }, [cari]);

  /* Pop-up tumbuh dari baris yang ditekan, sama seperti ia tumbuh dari
     provinsi yang ditekan di peta. Pulau diambil dari tabel lokal, bukan dari
     GetFeatureInfo: nilainya sama, tersedia seketika, dan ejaannya sudah pasti
     cocok dengan kunci tab pop-up. */
  const pilih = (nama: string, e: React.MouseEvent<HTMLElement>) => {
    const kotak = e.currentTarget.getBoundingClientRect();
    setCari("");
    onPilihWilayah(nama, inferPulau(nama), {
      x: kotak.left + kotak.width / 2,
      y: kotak.top + kotak.height / 2,
    });
  };

  // Tertutup: hanya tombol di kanan, peta tak terhalang.
  if (!terbuka) {
    return (
      <div className="flex justify-start md:hidden panggung:hidden">
        <button
          type="button"
          onClick={() => setTerbuka(true)}
          aria-expanded="false"
          className="pointer-events-auto flex items-center gap-2 rounded-full bg-api
                     px-[clamp(14px,4vw,18px)] py-[clamp(9px,2.6vw,12px)]
                     text-[length:var(--ukuran-catatan)] font-semibold tracking-wide uppercase text-white
                     shadow-[0_4px_16px_rgb(0_0_0/0.28)] transition-transform active:scale-95"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2"
               strokeLinecap="round" className="size-[clamp(16px,4.6vw,20px)]">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.6-3.6" />
          </svg>
          Cari provinsi
        </button>
      </div>
    );
  }

  return (
    <div className="relative mx-auto w-full max-w-[940px] md:hidden panggung:hidden">
      {/* Tombol tutup — mengembalikan peta yang tak terhalang. */}
      <div className="mb-[clamp(8px,2.4vw,12px)] flex justify-end">
        <button
          type="button"
          onClick={() => { setTerbuka(false); setCari(""); }}
          aria-label="Tutup panel provinsi"
          className="flex items-center gap-1.5 rounded-full bg-white/95 px-[clamp(12px,3.4vw,16px)]
                     py-[clamp(7px,2vw,10px)] text-[length:var(--ukuran-catatan)] font-semibold text-tinta
                     shadow-[0_3px_14px_rgb(0_0_0/0.22)] transition-transform active:scale-95"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2"
               strokeLinecap="round" className="size-[clamp(15px,4.2vw,18px)]">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
          Tutup
        </button>
      </div>

      <div className="relative z-[6]">
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2"
             strokeLinecap="round"
             className="pointer-events-none absolute top-1/2 left-[clamp(14px,4vw,20px)] size-[clamp(18px,5vw,22px)]
                        -translate-y-1/2 text-black/35">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.6-3.6" />
        </svg>

        <input
          type="search" value={cari} onChange={(e) => setCari(e.target.value)}
          placeholder="Cari provinsi…" aria-label="Cari provinsi"
          className="w-full rounded-[16px] bg-[#fdf3f2] py-[clamp(12px,3.4vw,16px)] pr-[clamp(14px,4vw,20px)]
                     pl-[clamp(40px,11vw,52px)] text-[length:var(--ukuran-nama)] leading-[1.2] text-tinta
                     shadow-[0_3px_16px_rgb(0_0_0/0.16)] outline-none placeholder:text-black/35
                     focus-visible:ring-2 focus-visible:ring-white/70 [&::-webkit-search-cancel-button]:hidden"
        />

        {cari.trim() && (
          <ul className="absolute inset-x-0 top-[calc(100%+6px)] max-h-[min(52svh,320px)] overflow-y-auto
                         rounded-[14px] bg-white py-1 shadow-[0_14px_34px_rgb(0_0_0/0.3)]">
            {hasil.length > 0 ? (
              hasil.map((nama) => (
                <li key={nama}>
                  <button type="button" onClick={(e) => pilih(nama, e)}
                          className="flex w-full items-center gap-3 px-[clamp(12px,3.4vw,16px)] py-[10px] text-left
                                     transition-colors hover:bg-black/5">
                    <Siluet jalur={siluet[nama]} className="size-[clamp(24px,7vw,32px)] shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-[length:var(--ukuran-nama)] font-semibold">
                      {nama}
                    </span>
                    <span className="shrink-0 text-[length:var(--ukuran-catatan)] text-black/45">
                      {inferPulau(nama)}
                    </span>
                  </button>
                </li>
              ))
            ) : (
              <li className="px-[clamp(12px,3.4vw,16px)] py-[12px] text-[length:var(--ukuran-catatan)] text-black/55">
                Provinsi tidak ditemukan.
              </li>
            )}
          </ul>
        )}
      </div>

      {/* Layanan luar yang sama dengan warna peta. Kalau tak terjangkau,
          daftarnya tidak ada isinya — kolom pencarian tetap berguna sendiri. */}
      {teratas.length > 0 && (
        <div className="panggung:hidden">
          <p className="mt-[clamp(16px,4.6vw,26px)] text-[length:var(--ukuran-eyebrow)] leading-[1.2] font-bold
                        tracking-[0.16em] uppercase text-white">
            3 provinsi dengan kebakaran terluas
          </p>

          <ul className="mt-[clamp(8px,2.6vw,14px)] grid gap-[clamp(10px,3vw,16px)]">
            {teratas.map((p) => {
              const nama = namaProvinsiLokal(p.nama);
              return (
                <li key={p.nama}>
                  <button type="button" onClick={(e) => pilih(nama, e)}
                          className="flex w-full items-center gap-[clamp(10px,3vw,18px)] rounded-[10px] bg-white
                                     p-[clamp(12px,3.6vw,18px)] text-left shadow-[0_4px_18px_rgb(0_0_0/0.16)]
                                     transition hover:-translate-y-[1px] hover:shadow-[0_8px_24px_rgb(0_0_0/0.22)]">
                    <span aria-hidden="true"
                          className="w-[clamp(14px,4.4vw,24px)] shrink-0 text-center
                                     text-[length:var(--ukuran-nilai)] leading-[1] font-bold text-black/20">
                      {p.peringkat}
                    </span>
                    <Siluet jalur={siluet[nama]}
                            className="h-[clamp(44px,13vw,70px)] w-[clamp(52px,16vw,88px)] shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[length:var(--ukuran-label)] leading-[1.15] font-bold">
                        {nama}
                      </span>
                      <span className="block text-[length:var(--ukuran-catatan)] leading-[1.4] text-black/45">
                        {p.pulau}
                      </span>
                      <span className="mt-[clamp(6px,2vw,12px)] flex items-baseline justify-between gap-3">
                        <span className="text-[length:var(--ukuran-catatan)] text-black/55">Luas kebakaran</span>
                        <span className="text-[length:var(--ukuran-catatan)] font-bold whitespace-nowrap text-tinta">
                          {p.luas} ha
                        </span>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function Siluet({ jalur, className }: { jalur?: Jalur; className: string }) {
  // Sebelum berkas geometrinya tiba, tempatnya sudah dipesan supaya barisnya
  // tidak melompat saat gambarnya muncul.
  if (!jalur) return <span aria-hidden="true" className={className} />;

  return (
    <svg viewBox={jalur.viewBox} aria-hidden="true" preserveAspectRatio="xMidYMid meet" className={className}>
      <path d={jalur.d} fillRule="evenodd" fill="var(--color-merah-psp)"
            stroke="var(--color-garis)" strokeWidth="1.5" strokeLinejoin="round"
            vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
