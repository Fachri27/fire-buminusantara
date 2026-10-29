"use client";

import { TombolKonfirmasi } from "../tombol-konfirmasi";
import { useAksi } from "../use-aksi";
import { aksiTandaiDitinjau } from "../laporan-konten/aksi";
import { akhiriSiaran } from "./alat";

/**
 * Akhiri siaran — dua tekan (TombolKonfirmasi). Laporan konten untuk ruang
 * itu ikut ditandai ditinjau: siarannya sudah ditindak. Gagal menandai tidak
 * membatalkan apa pun — siarannya tetap sudah berakhir.
 */
export function TombolAkhiri({ ruang, lalu, ringkas = false }: {
  ruang: string;
  /** Sesudah berhasil, mis. menutup penonton & memuat ulang daftar. */
  lalu?: () => void;
  ringkas?: boolean;
}) {
  const [sibuk, jalankan] = useAksi();
  const kecil = ringkas ? "cms-tombol cms-tombol--kecil" : "cms-tombol";
  return (
    <TombolKonfirmasi
      label="Akhiri siaran"
      labelKonfirmasi="Ya, akhiri"
      className={`${kecil} ${ringkas ? "cms-tombol--hantu-bahaya" : "cms-tombol--bahaya"}`}
      classNameKonfirmasi={`${kecil} cms-tombol--bahaya-isi`}
      sibuk={sibuk}
      durasiDetik={5}
      onKonfirmasi={() =>
        jalankan(async () => {
          const hasil = await akhiriSiaran(ruang);
          if (hasil.ok) await aksiTandaiDitinjau("siaran", ruang).catch(() => null);
          return hasil;
        }, "Siaran diakhiri. Pelapor dan penonton terputus.", lalu)
      }
    />
  );
}
