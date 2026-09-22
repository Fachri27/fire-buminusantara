/**
 * Draf komposer laporan, bertahan di localStorage.
 *
 * Komposer di rel kanan (lihat KomposerLapor di landing-karhutla.tsx) hidup di
 * dalam komponen halaman. Tab peta seluler menunjuk ke /karhutla/panel dan
 * tombol "+" di sana menunjuk balik ke /karhutla — dua rute, jadi App Router
 * me-mount ulang komposer itu dan seluruh state-nya lahir kosong lagi. Draf ini
 * yang membuat apa yang sudah diketik selamat menyeberang.
 *
 * Lampiran tidak ikut: objek File tidak bisa ditaruh di localStorage.
 */
const KUNCI = "lapor_draf";

export type DrafLapor = {
  judul: string;
  deskripsi: string;
  nama: string;
  lat: string;
  lng: string;
  anonim: boolean;
};

export const DRAF_KOSONG: DrafLapor = {
  judul: "",
  deskripsi: "",
  nama: "",
  lat: "",
  lng: "",
  anonim: false,
};

function teks(sumber: Record<string, unknown>, kunci: keyof DrafLapor): string {
  const nilai = sumber[kunci];
  return typeof nilai === "string" ? nilai : "";
}

/**
 * Uraikan draf dari teks tersimpan. Apa pun yang tidak terbaca — null, JSON
 * rusak, tipe yang salah, kunci yang hilang — jatuh ke draf kosong: isian yang
 * hilang lebih baik daripada komposer yang meledak saat dibuka.
 */
export function uraiDraf(simpanan: string | null): DrafLapor {
  if (!simpanan) return DRAF_KOSONG;
  let mentah: unknown;
  try {
    mentah = JSON.parse(simpanan);
  } catch {
    return DRAF_KOSONG;
  }
  if (typeof mentah !== "object" || mentah === null || Array.isArray(mentah)) return DRAF_KOSONG;
  const d = mentah as Record<string, unknown>;
  return {
    judul: teks(d, "judul"),
    deskripsi: teks(d, "deskripsi"),
    nama: teks(d, "nama"),
    lat: teks(d, "lat"),
    lng: teks(d, "lng"),
    anonim: d.anonim === true,
  };
}

/** Ada sesuatu yang layak disimpan? Kiriman yang berhasil mengosongkan semua
 *  isian komposer, jadi predikat inilah yang membersihkan draf. */
export function drafBerisi(d: DrafLapor): boolean {
  return Boolean(d.judul || d.deskripsi || d.nama || d.lat || d.lng || d.anonim);
}

/** Draf tersimpan, atau draf kosong bila belum ada / storage tak bisa dibaca
 *  (mode privat, kuki diblokir) — juga saat dipanggil di server. */
export function bacaDraf(): DrafLapor {
  if (typeof window === "undefined") return DRAF_KOSONG;
  try {
    return uraiDraf(localStorage.getItem(KUNCI));
  } catch {
    return DRAF_KOSONG;
  }
}

/** Simpan draf, atau buang simpanannya begitu isinya habis. */
export function simpanDraf(d: DrafLapor): void {
  if (typeof window === "undefined") return;
  try {
    if (drafBerisi(d)) localStorage.setItem(KUNCI, JSON.stringify(d));
    else localStorage.removeItem(KUNCI);
  } catch {
    /* storage penuh atau diblokir — draf sekadar tak tersimpan */
  }
}
