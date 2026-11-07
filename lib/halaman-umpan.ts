import type { Berita } from "./events.ts";
import { waktuIso, waktuTeks } from "./tanggal.ts";
import { PULAU_TAB } from "./wilayah.ts";

/** Kartu umpan per halaman — HTML halaman membawa halaman pertama, sisanya
 *  diambil klien dari /api/umpan/halaman saat digulir. Modul ini bebas
 *  Prisma supaya konstanta ini boleh diimpor komponen klien. */
export const UMPAN_AWAL = 15;

export type SaringanUmpan = {
  kata: string;
  /** "YYYY-MM-DD" atau kosong. */
  dari: string;
  sampai: string;
  /** "semua" atau kunci PULAU_TAB. */
  wilayah: string;
  urut: "terbaru" | "komentar";
};

export const SARINGAN_BAWAAN: SaringanUmpan = { kata: "", dari: "", sampai: "", wilayah: "semua", urut: "terbaru" };

export type HalamanUmpan = {
  isi: Berita[];
  /** Posisi halaman berikutnya (cadangan bila jangkarnya hilang); null = habis. */
  berikut: number | null;
  /** Banyak laporan per opsi wilayah (setelah kata + tanggal) — angka di pemilih wilayah. */
  jumlahWilayah: Record<string, number>;
};

const diPulau = (isi: readonly string[]) => (b: Berita) => !!b.pulau && isi.includes(b.pulau);

/** Angka tiap opsi wilayah ("semua" + tiap tab pulau) dari daftar yang diberikan. */
export function hitungWilayah(daftar: Berita[]): Record<string, number> {
  const jumlah: Record<string, number> = { semua: daftar.length };
  for (const tab of PULAU_TAB) jumlah[tab.kunci] = daftar.filter(diPulau(tab.isi)).length;
  return jumlah;
}

/**
 * Satu halaman umpan beranda dari daftar ambilUmpan (sudah terbaru dulu:
 * event_date lalu id menurun). Kata kunci + tanggal lebih dulu, wilayah
 * belakangan: jumlahWilayah dihitung dari tahap pertama, jadi "(5 laporan)"
 * selalu sama dengan banyak kartu yang muncul saat opsi itu dipilih.
 *
 * Halaman berikutnya berjangkar pada `setelah` (id kartu terakhir yang sudah
 * tampil), bukan posisi: laporan yang masuk, dihapus, atau cache yang beda
 * versi di antara dua permintaan tidak membuat kartu terlewat atau ganda.
 * `kursor` (posisi) hanya cadangan bila kartu jangkar itu sudah hilang.
 */
export function halamanUmpan(semua: Berita[], s: SaringanUmpan, kursor = 0, setelah: number | null = null): HalamanUmpan {
  const kata = s.kata.trim().toLowerCase();
  const awal = waktuIso(s.dari);
  const akhir = waktuIso(s.sampai);
  const sebelumWilayah = semua.filter((b) => {
    if (kata && !b.judul.toLowerCase().includes(kata)) return false;
    const waktu = waktuTeks(b.tanggal);
    if (waktu === null) return true; // tanggal tak terbaca: jangan disembunyikan
    if (awal !== null && waktu < awal) return false;
    if (akhir !== null && waktu > akhir) return false;
    return true;
  });
  const tab = PULAU_TAB.find((x) => x.kunci === s.wilayah);
  const tersaring = tab ? sebelumWilayah.filter(diPulau(tab.isi)) : sebelumWilayah;
  // Terbaru = urutan sumber. Komentar: sort stabil, jadi seri tetap terbaru dulu.
  const urut = s.urut === "komentar"
    ? [...tersaring].sort((a, b) => (b.jumlahKomentar ?? 0) - (a.jumlahKomentar ?? 0))
    : tersaring;
  const jangkar = setelah === null ? -1 : urut.findIndex((b) => b.id === setelah);
  const mulai = jangkar >= 0 ? jangkar + 1 : kursor;
  const ujung = mulai + UMPAN_AWAL;
  return {
    isi: urut.slice(mulai, ujung),
    berikut: ujung < urut.length ? ujung : null,
    jumlahWilayah: hitungWilayah(sebelumWilayah),
  };
}

const TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

/** Saringan + kursor + jangkar dari query string publik — nilai asing jatuh ke bawaan. */
export function saringanDariUrl(p: URLSearchParams): SaringanUmpan & { kursor: number; setelah: number | null } {
  const wilayah = p.get("wilayah") ?? "";
  const kursor = Number.parseInt(p.get("kursor") ?? "", 10);
  const setelah = Number.parseInt(p.get("setelah") ?? "", 10);
  const tanggal = (v: string | null) => (v && TANGGAL.test(v) ? v : "");
  return {
    kata: (p.get("cari") ?? "").slice(0, 100),
    dari: tanggal(p.get("dari")),
    sampai: tanggal(p.get("sampai")),
    wilayah: PULAU_TAB.some((t) => t.kunci === wilayah) ? wilayah : "semua",
    urut: p.get("urut") === "komentar" ? "komentar" : "terbaru",
    kursor: Number.isFinite(kursor) && kursor > 0 ? kursor : 0,
    setelah: Number.isFinite(setelah) && setelah > 0 ? setelah : null,
  };
}
