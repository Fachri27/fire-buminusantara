/**
 * Batas kiriman laporan warga.
 *
 * Berkas tersendiri, TANPA impor apa pun: angka-angka ini dibaca dua sisi —
 * form di peramban (untuk menahan kiriman sebelum berangkat) dan penyimpan di
 * server (untuk menolak yang lolos). Kalau ia menumpang lib/laporan-publik.ts,
 * mengimpornya dari komponen klien ikut menyeret lib/unggah.ts beserta
 * `node:fs` ke dalam bundel peramban, dan build gagal di sana.
 */

/**
 * Jumlah lampiran per laporan.
 *
 * Bukan sekadar angka enak: seluruh form dikirim sebagai SATU permintaan server
 * action, dan atapnya `serverActions.bodySizeLimit` di next.config.ts. Enam
 * berkas masih muat untuk foto ponsel; kalau semuanya video panjang, batas
 * ukuran total di bawahlah yang menahan lebih dulu.
 */
export const BATAS_BERKAS = 6;

/** Atap ukuran total satu kiriman, disamakan dengan bodySizeLimit. */
export const BATAS_TOTAL_BYTE = 100 * 1024 * 1024;
