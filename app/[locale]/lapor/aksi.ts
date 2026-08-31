"use server";

import { headers } from "next/headers";
import { simpanLaporanPublik, type HasilLapor } from "@/lib/laporan-publik";
import { ipDari } from "@/lib/turnstile";

/** Keadaan yang dibaca form lewat useActionState. `null` = belum ada kiriman. */
export type KeadaanLapor = HasilLapor | null;

/**
 * Terima laporan warga.
 *
 * Server action, bukan route JSON seperti komentar: yang dikirim di sini
 * termasuk berkas, dan <form> yang menyerahkan FormData apa adanya membuat
 * berkasnya sampai ke server tanpa disentuh sedikit pun — tidak ada langkah
 * baca-ulang di klien yang bisa menggugurkan EXIF gambar.
 *
 * Batas ukuran badannya disetel di next.config.ts (100 MB).
 */
export async function kirimLaporan(
  _sebelumnya: KeadaanLapor,
  data: FormData,
): Promise<KeadaanLapor> {
  // Server action tidak menerima Request, jadi headernya diambil sendiri.
  const kepala = await headers();
  const ip = ipDari(new Request("http://lokal", { headers: kepala }));

  return simpanLaporanPublik(data, ip);
}
