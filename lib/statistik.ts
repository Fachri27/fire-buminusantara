import { type Bahasa } from "./bahasa";

/** Satu kartu pada strip "Angka hari ini". */
export type Statistik = {
  tanggal: string;
  label: string;
  nilai: string;
  keterangan: string;
};

/**
 * Isi strip statistik, per bahasa.
 *
 * Angka tetap (belum ada tabelnya di CMS). `nilai` = angka besar, `keterangan`
 * = penjelas di bawahnya. `tanggal` dan `label` dikosongkan: rentang di sini
 * historis (2000–2024) dan setengah-tahunan (2026), bukan "angka hari ini",
 * jadi tak ada eyebrow tanggal harian maupun judul kartu — kartunya cukup
 * menampilkan angka dan penjelasnya.
 *
 * Angkanya sendiri (nilai) diformat sesuai bahasa: id memakai koma desimal &
 * titik ribuan ("9,5 juta ha", "178.232 ha"), en memakai gaya Inggris.
 */
const DATA: Record<Bahasa, Statistik[]> = {
  id: [
    { tanggal: "", label: "", nilai: "9,5 juta ha", keterangan: "area terbakar 2000-2024" },
    { tanggal: "", label: "", nilai: "40%", keterangan: "area terbakar 2000-2024 berada di lahan gambut" },
    { tanggal: "", label: "", nilai: "178.232 ha", keterangan: "area terbakar Januari-Juni 2026" },
    { tanggal: "", label: "", nilai: "21%", keterangan: "area terbakar Januari-Juni 2026 berada di Kalimantan" },
  ],
  en: [
    { tanggal: "", label: "", nilai: "9.5 Mha", keterangan: "2000-2024 burned areas" },
    { tanggal: "", label: "", nilai: "40%", keterangan: "2000-2024 burned areas are on peat land" },
    { tanggal: "", label: "", nilai: "178,232 ha", keterangan: "January-June 2026 burned areas" },
    { tanggal: "", label: "", nilai: "21%", keterangan: "January-June 2026 burned areas are in Kalimantan" },
  ],
};

/** Ditaruh di berkas tersendiri supaya jelas mana yang nanti perlu diganti
 *  sumber sungguhan, cukup mengubah satu tabel tanpa menyentuh komponennya. */
export function ambilStatistik(bahasa: Bahasa): Statistik[] {
  return DATA[bahasa];
}
