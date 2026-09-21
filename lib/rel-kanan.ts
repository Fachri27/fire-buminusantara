/**
 * Inti murni ambilRelKanan — modul tanpa dependensi basis data supaya bisa
 * diuji langsung. `semua` sudah terurut terbaru dulu (event_date desc, id
 * desc): `baru` teratas jadi kelompok terbaru, sisanya diurut komentar
 * terbanyak (seri → terbaru dulu, lalu id) untuk kelompok populer.
 */
export function bagiRelKanan<T extends { id: number | bigint; event_date: Date }>(
  semua: T[],
  jumlahKomentar: Map<number, number>,
  baru = 5,
  ramai = 5,
): { terbaru: T[]; populer: T[] } {
  const komentar = (b: T) => jumlahKomentar.get(Number(b.id)) ?? 0;

  const terbaru = semua.slice(0, baru);
  const idTerbaru = new Set(terbaru.map((b) => Number(b.id)));
  const populer = semua
    .filter((b) => !idTerbaru.has(Number(b.id)))
    .sort((a, b) => {
      const beda = komentar(b) - komentar(a); // komentar terbanyak dulu
      if (beda !== 0) return beda;
      const bedaTgl = b.event_date.getTime() - a.event_date.getTime();
      if (bedaTgl !== 0) return bedaTgl;
      return Number(b.id) - Number(a.id);
    })
    .slice(0, ramai);

  return { terbaru, populer };
}
