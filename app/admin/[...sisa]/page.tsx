import { notFound } from "next/navigation";

/**
 * Penangkap alamat /admin yang tidak cocok rute mana pun.
 *
 * Tanpa ini, /admin/salah-ketik tidak pernah masuk pohon segmen /admin sama
 * sekali: Next tidak menemukan rute, lalu merender app/not-found.tsx — 404
 * publik bertombol "English Version", di tengah sesi CMS. Segmen tangkap-semua
 * ini menariknya masuk lebih dulu, lalu memanggil notFound() supaya batas
 * terdekat — app/admin/not-found.tsx — yang menjawab.
 *
 * Rute yang lebih spesifik selalu menang atas tangkap-semua, jadi berkas ini
 * tidak pernah menaungi halaman CMS yang sudah ada maupun yang akan ditambah.
 *
 * Harganya: alamat tak dikenal di bawah /admin kini dijawab HTTP 200, bukan
 * 404. Di bawah Cache Components kerangka layout sudah terkirim sebelum
 * notFound() sempat memutuskan, jadi statusnya terlanjur ditulis — persis
 * seperti /admin/laporan/999999 yang sudah begitu sejak dulu. Untuk panel
 * ber-robots noindex di balik sesi, rupa halaman lebih berarti daripada
 * statusnya; `await connection()` di sini pun tidak mengubahnya.
 */
export default function AlamatTakDikenal() {
  notFound();
}
