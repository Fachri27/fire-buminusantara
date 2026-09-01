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
 *
 * HANYA dipanggil di komponen server: tanggalnya dihitung dari new Date(),
 * dan zona waktunya dipatok Asia/Jakarta. Kalau dipanggil di render komponen
 * klien, server (kontainer UTC) dan peramban pengunjung (WIB) bisa berbeda
 * tanggal — 00.00–07.00 WIB teksnya tak cocok dan hidrasi React gagal
 * (error #418). Dipanggil di server, teksnya dihitung sekali lalu dikirim
 * sebagai prop, jadi selalu sama.
 */
export function ambilStatistik(): Statistik[] {
  const tanggal = new Intl.DateTimeFormat("id-ID", {
    day: "numeric", month: "long", year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date());

  return [1, 2, 3, 4, 5].map((n) => ({
    tanggal,
    label: `Statistik ${n}`,
    nilai: "",
    keterangan: "",
  }));
}
