/**
 * Sinyal "tutup semua overlay beranda".
 *
 * Pop-up rincian dan pop-up wilayah hidup sebagai state React di dalam
 * HalamanFire, sedangkan bilah navigasi adalah komponen BERSAUDARA yang
 * dirender langsung oleh halaman (app/[locale]/page.tsx, .../fire/[slug]).
 * Tidak ada induk klien bersama yang bisa menampung state itu, jadi nav
 * meminta lewat peristiwa window alih-alih mengangkat state ke atas.
 *
 * Kenapa peristiwa, bukan sekadar bersandar pada perubahan rute:
 *
 * - Pop-up wilayah TIDAK menyentuh URL sama sekali. Klik logo dari beranda
 *   berarti navigasi ke path yang sama persis, dan Next tidak merender ulang
 *   apa pun — tidak ada sinyal rute yang bisa disimak.
 * - Pop-up rincian mengubah URL lewat history.pushState mentah. Halamannya
 *   tidak pernah berganti, jadi HalamanFire tetap terpasang dengan state-nya
 *   utuh sekalipun URL sudah kembali ke beranda.
 *
 * Mengikuti pola yang sama dengan EVENT_TAMPILAN di CMS
 * (app/admin/kejadian/daftar-tampilan.tsx).
 */
export const TUTUP_OVERLAY = "fire_tutup_overlay";

/** Dipanggil bilah navigasi sebelum berpindah/menggulir ke bagian halaman. */
export function mintaTutupOverlay() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(TUTUP_OVERLAY));
  }
}
