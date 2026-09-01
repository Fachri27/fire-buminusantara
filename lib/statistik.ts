/** Satu kartu pada strip "Angka hari ini". */
export type Statistik = {
  tanggal: string;
  label: string;
  nilai: string;
  keterangan: string;
};

/**
 * Isi strip statistik.
 *
 * Angka tetap (belum ada tabelnya di CMS). `nilai` = angka besar, `keterangan`
 * = penjelas di bawahnya. `tanggal` dan `label` dikosongkan: rentang di sini
 * historis (2000–2024) dan setengah-tahunan (2026), bukan "angka hari ini",
 * jadi tak ada eyebrow tanggal harian maupun judul kartu — kartunya cukup
 * menampilkan angka dan penjelasnya, seperti rujukan desain.
 *
 * Ditaruh di berkas tersendiri supaya jelas mana yang nanti perlu diganti
 * sumber sungguhan, cukup mengubah satu fungsi tanpa menyentuh komponennya.
 */
export function ambilStatistik(): Statistik[] {
  return [
    { tanggal: "", label: "", nilai: "9.5 Mha", keterangan: "2000-2024 burned areas" },
    { tanggal: "", label: "", nilai: "40%", keterangan: "2000-2024 burned areas are on peat land" },
    { tanggal: "", label: "", nilai: "178,232 ha", keterangan: "January-June 2026 burned areas" },
    { tanggal: "", label: "", nilai: "21%", keterangan: "January-June 2026 burned areas are in Kalimantan" },
  ];
}
