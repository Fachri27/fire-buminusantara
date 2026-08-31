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
 * Masih data contoh, sama seperti window.STATISTIK di Pasopati — belum ada
 * tabelnya di CMS. Ditaruh di berkas tersendiri supaya jelas mana yang nanti
 * perlu diganti sumber sungguhan, dan supaya penggantinya cukup mengubah satu
 * fungsi tanpa menyentuh komponennya.
 */
export function ambilStatistik(): Statistik[] {
  const tanggal = new Intl.DateTimeFormat("id-ID", {
    day: "numeric", month: "long", year: "numeric",
  }).format(new Date());

  return [1, 2, 3, 4, 5].map((n) => ({
    tanggal,
    label: `Statistik ${n}`,
    nilai: "",
    keterangan: "",
  }));
}
