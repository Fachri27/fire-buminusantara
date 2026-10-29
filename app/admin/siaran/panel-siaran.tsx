"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Hampa } from "../ruang";
import { TautanSaring } from "../ruang-klien";
import { AMBANG_TURUN, type Siaran } from "./alat";
import { Penonton } from "./penonton";
import { TombolAkhiri } from "./tombol-akhiri";

const jam = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" });
/** Daftar dimuat ulang selama tab terlihat — siaran bisa mulai kapan saja. */
const JEDA_MUAT_MS = 5000;

/**
 * Siaran yang sedang berjalan (GET /api/admin/siaran) + penonton petugas.
 * `buka` = ruang dari ?ruang=… (tautan "Tonton" di antrean laporan konten).
 */
export function PanelSiaran({ awal, galatAwal, buka }: {
  awal: Siaran[]; galatAwal: string | null; buka: string | null;
}) {
  const [daftar, setDaftar] = useState(awal);
  const [galat, setGalat] = useState(galatAwal);
  // Disimpan utuh: siaran yang baru berakhir hilang dari daftar, tetapi
  // penontonnya tetap terbuka sampai petugas menutupnya.
  const [aktif, setAktif] = useState<Siaran | null>(() => awal.find((s) => s.ruang === buka) ?? null);
  // ?ruang=… yang belum ada di daftar awal (daftar server disimpan beberapa
  // detik; siarannya bisa baru mulai): dicari lagi di beberapa muat berikutnya.
  const tungguRef = useRef(buka && !awal.some((s) => s.ruang === buka) ? { ruang: buka, sisa: 3 } : null);
  const [hilang, setHilang] = useState(false);
  const tontonRef = useRef<HTMLElement | null>(null);

  const muat = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/siaran", { cache: "no-store" });
      const isi = await r.json().catch(() => null);
      if (r.ok && Array.isArray(isi)) {
        setDaftar(isi);
        setGalat(null);
        const t = tungguRef.current;
        const ketemu = t && (isi as Siaran[]).find((s) => s.ruang === t.ruang);
        if (t && ketemu) {
          tungguRef.current = null;
          setAktif((a) => a ?? ketemu);
        } else if (t && --t.sisa <= 0) {
          tungguRef.current = null;
          setHilang(true);
        }
      } else {
        setGalat(isi?.galat ?? `Daftar siaran gagal dimuat (HTTP ${r.status}).`);
      }
    } catch {
      setGalat("Koneksi terputus. Mencoba lagi…");
    }
  }, []);

  useEffect(() => {
    if (tungguRef.current) muat();
    const t = setInterval(() => {
      if (!document.hidden) muat();
    }, JEDA_MUAT_MS);
    return () => clearInterval(t);
  }, [muat]);

  const tonton = (s: Siaran) => {
    setAktif(s);
    requestAnimationFrame(() => tontonRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const info = aktif ? (daftar.find((s) => s.ruang === aktif.ruang) ?? aktif) : null;

  return (
    <div className="grid gap-6">
      {galat && <p role="alert" className="cms-galat">{galat}</p>}
      {hilang && !aktif && (
        <p className="text-[13px] text-[var(--lirih)]">
          Siaran <span className="cms-angka">{buka}</span> sudah berakhir atau tidak ditemukan.
        </p>
      )}

      {/* Penonton di atas daftar: adaptiveStream LiveKit menghentikan video
          yang elemennya di luar layar, jadi ia harus langsung terlihat. */}
      {info && (
        <section ref={tontonRef} aria-label="Menonton siaran" className="scroll-mt-16">
          <Penonton key={info.ruang} siaran={info} onTutup={() => setAktif(null)}
                    onBerakhir={() => {
                      setAktif(null);
                      muat();
                    }} />
        </section>
      )}

      <section aria-labelledby="judul-berlangsung">
        <h2 id="judul-berlangsung" className="cms-mata mb-2">Sedang berlangsung ({daftar.length})</h2>
        {daftar.length === 0 ? (
          <div className="cms-tabel-bingkai">
            <Hampa judul="Belum ada siaran" ikon="siaran">
              Siaran warga dari aplikasi muncul di sini begitu dimulai — daftar ini diperbarui otomatis.
            </Hampa>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {daftar.map((s) => (
              <li key={s.ruang} aria-current={aktif?.ruang === s.ruang || undefined}
                  className="cms-kartu flex flex-col gap-1.5 p-4 aria-[current]:shadow-[0_0_0_2px_var(--limau)]">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="cms-cap cms-cap--perhatian cms-cap--titik">Langsung</span>
                  <span className="cms-cap cms-cap--diam">{s.publik ? "Publik" : "Khusus petugas"}</span>
                  {(s.laporan ?? 0) > 0 && (
                    <TautanSaring bagian="laporan-konten" nilai={{ jenis: "siaran" }} className="cms-cap cms-cap--perhatian hover:underline">
                      Dilaporkan {s.laporan} akun{s.publik && (s.laporan ?? 0) >= AMBANG_TURUN ? " · turun dari beranda" : ""}
                    </TautanSaring>
                  )}
                </span>
                <p className="font-semibold [overflow-wrap:anywhere]">{s.judul}</p>
                <p className="text-[12.5px] text-[var(--lirih)]">
                  {/* Zona waktu server (render awal) bisa beda dengan peramban. */}
                  {s.nama} · mulai <time suppressHydrationWarning>{jam.format(s.mulai)}</time> · {s.penonton} menonton
                </p>
                {s.lat !== null && s.lng !== null && (
                  <p className="cms-angka text-[12px] text-[var(--lirih)]">{s.lat.toFixed(4)}, {s.lng.toFixed(4)}</p>
                )}
                <span className="mt-auto flex flex-wrap items-center gap-1.5 pt-2">
                  <button type="button" onClick={() => tonton(s)} className="cms-tombol cms-tombol--utama cms-tombol--kecil">
                    {aktif?.ruang === s.ruang ? "Sedang ditonton" : "Tonton"}
                  </button>
                  <TombolAkhiri ruang={s.ruang} ringkas lalu={() => {
                    if (aktif?.ruang === s.ruang) setAktif(null);
                    muat();
                  }} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

    </div>
  );
}
