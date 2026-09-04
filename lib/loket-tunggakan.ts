import { EventEmitter } from "node:events";

/**
 * Loket kabar tunggakan CMS — pemicu instan lencana di menu admin.
 *
 * Angka "Laporan Warga" dan "Komentar" dulu hanya dihitung ulang saat petugas
 * bernavigasi atau menekan "Muat ulang": laporan yang masuk selagi ia diam di
 * satu halaman baru terlihat setelah ia bergerak. Loket ini menutup jarak itu.
 * Aksi yang mengubah salah satu antrean memanggil `umumkanTunggakan()`, dan
 * aliran SSE di app/api/admin/tunggakan/aliran mengirim angka baru ke setiap
 * tab CMS yang terbuka.
 *
 * SENGAJA emitter dalam-proses, bukan Redis/pub-sub: satu kontainer web
 * melayani pengirim laporan sekaligus tab CMS, jadi peristiwanya tidak perlu
 * menyeberang proses. Bila suatu saat webnya direplikasi, pengumuman dari
 * replika lain memang tidak sampai — itulah sebabnya alirannya TETAP mencek
 * database secara berkala sebagai jaring pengaman. Yang hilang cuma
 * keinstanannya, bukan kebenaran angkanya.
 *
 * Disimpan di globalThis supaya HMR `next dev` tidak menyisakan emitter yatim
 * setiap modul ini dikompilasi ulang: pelanggan lama akan menempel di instans
 * yang tak seorang pun mengumumkan lagi.
 */
const ruang = globalThis as typeof globalThis & { __loketTunggakan?: EventEmitter };

const loket = (ruang.__loketTunggakan ??= new EventEmitter());

// Satu pelanggan per tab CMS yang terbuka. Batas bawaan 10 akan memuntahkan
// MaxListenersExceededWarning begitu sebelas tab dibuka — padahal itu justru
// pemakaian normalnya.
loket.setMaxListeners(0);

const PERISTIWA = "ubah";

/** Beri tahu semua tab CMS bahwa salah satu antrean berubah. */
export function umumkanTunggakan() {
  // Pengumuman tidak boleh menjatuhkan aksi yang memanggilnya: menyimpan
  // laporan sudah berhasil sebelum baris ini.
  try {
    loket.emit(PERISTIWA);
  } catch {}
}

/** Berlangganan kabar perubahan. Kembaliannya melepas langganan. */
export function berlanggananTunggakan(saatUbah: () => void): () => void {
  loket.on(PERISTIWA, saatUbah);
  return () => {
    loket.off(PERISTIWA, saatUbah);
  };
}
