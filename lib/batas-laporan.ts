/**
 * Batas kiriman laporan warga.
 *
 * Berkas tersendiri, TANPA impor apa pun: angka-angka ini dibaca dua sisi —
 * form di peramban (untuk menahan kiriman sebelum berangkat) dan penyimpan di
 * server (untuk menolak yang lolos). Kalau ia menumpang lib/laporan-publik.ts,
 * mengimpornya dari komponen klien ikut menyeret lib/unggah.ts beserta
 * `node:fs` ke dalam bundel peramban, dan build gagal di sana.
 *
 * Penjaga kiriman di bagian bawah (tolakUkuran, bergiliran) hanya dipakai
 * rute server, tapi cukup dengan Request/Response bawaan — tetap tanpa impor.
 */

/**
 * Jumlah lampiran per laporan.
 *
 * Bukan sekadar angka enak: seluruh form dikirim sebagai SATU permintaan, dan
 * atapnya BATAS_TOTAL_BYTE di bawah. Enam berkas masih muat untuk foto ponsel;
 * kalau semuanya video panjang, batas ukuran total itulah yang menahan lebih dulu.
 */
export const BATAS_BERKAS = 6;

/** Atap ukuran total lampiran satu kiriman. */
export const BATAS_TOTAL_BYTE = 100 * 1024 * 1024;

/** Kelonggaran Content-Length di atas atap lampiran: pembatas multipart + isian teks. */
export const CADANGAN_MULTIPART = 1024 * 1024;

/** Angka koordinat ketikan warga: papan ketik Indonesia sering memberi koma
 *  desimal ("-1,234"), dan `Number("-1,234")` = NaN. */
function angkaKoordinat(mentah: string): number {
  return Number(mentah.trim().replace(",", "."));
}

/**
 * Koordinat opsional, tapi tidak setengah-setengah: satu tanpa yang lain
 * bukan lokasi, dan menyimpannya begitu hanya menipu peninjau.
 *
 * Dipakai form di peramban (menolak SEBELUM unggahan 100 MB berangkat) dan
 * server (menolak yang lolos), maka tinggal di berkas tanpa impor ini.
 */
export function koordinat(
  latMentah: string,
  lngMentah: string,
): { lat: number; lng: number } | null | { galat: string } {
  const adaLat = latMentah.trim() !== "";
  const adaLng = lngMentah.trim() !== "";
  if (!adaLat && !adaLng) return null;
  if (adaLat !== adaLng) return { galat: "Latitude dan longitude harus diisi berdua." };

  const lat = angkaKoordinat(latMentah);
  const lng = angkaKoordinat(lngMentah);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    return { galat: "Latitude harus angka antara -90 dan 90." };
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    return { galat: "Longitude harus angka antara -180 dan 180." };
  }
  if (lat === 0 && lng === 0) {
    return { galat: "Titik 0, 0 bukan lokasi di Indonesia. Periksa lagi atau kosongkan." };
  }
  return { lat, lng };
}

/** Ukuran berkas untuk dibaca warga ("12.3 MB"), dipakai kedua form lapor. */
export function ukuranTeks(byte: number): string {
  if (byte >= 1024 * 1024) return `${(byte / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(byte / 1024))} KB`;
}

/**
 * Tolak kiriman dari Content-Length-nya saja, SEBELUM badannya disentuh.
 * null = boleh lanjut. `wajibPanjang`: tanpa Content-Length (chunked) dijawab
 * 411 — ukurannya baru ketahuan setelah semuanya disangga. Rute mobile tidak
 * mewajibkannya, sama seperti sebelumnya: klien React Native tidak dijamin
 * mengirim Content-Length, dan atap kerasnya client_max_body_size di reverse proxy.
 */
export function tolakUkuran(req: Request, wajibPanjang: boolean): Response | null {
  const panjang = req.headers.get("content-length");
  if (panjang === null && wajibPanjang) {
    return Response.json({ ok: false, galat: "Kiriman tidak bisa dibaca server." }, { status: 411 });
  }
  if (Number(panjang ?? 0) > BATAS_TOTAL_BYTE + CADANGAN_MULTIPART) {
    return Response.json(
      { ok: false, galat: "Ukuran total lampiran melebihi 100 MB.", bidang: "berkas" },
      { status: 413 },
    );
  }
  return null;
}

/**
 * Kiriman yang badannya disangga bersamaan, untuk SATU PROSES — form web
 * (/api/lapor) dan aplikasi (/api/mobile/laporan) berbagi jatah yang sama.
 * req.formData() memakan ±3–4× ukuran kiriman, dan container web beratap 2 GB
 * (docker-compose.prod.yml): unggahan 100 MB keempat membuat OOM killer
 * mematikan situs untuk semua pengunjung. Yang lebih dari ini dijawab 503
 * "coba lagi", bukan menjatuhkan situs.
 */
export const BATAS_SERENTAK = 3;

/** Di globalThis, bukan variabel modul: bundler bisa memberi tiap rute salinan
 *  modulnya sendiri, padahal jatah ini milik seluruh proses. */
function jatah(): { n: number } {
  const g = globalThis as { __laporSerentak?: { n: number } };
  return (g.__laporSerentak ??= { n: 0 });
}

/**
 * Jalankan `terima` (yang menyangga badan kiriman) bila masih ada jatah;
 * penuh = 503. Panggil SETELAH semua gerbang yang bisa diputuskan dari header
 * (ukuran, batas laju, captcha/akun) — kalau tidak, klien tanpa captcha bisa
 * menduduki jatah dan setiap warga lain mendapat 503.
 */
export async function bergiliran(req: Request, terima: () => Promise<Response>): Promise<Response> {
  const j = jatah();
  if (j.n >= BATAS_SERENTAK) {
    await buangBadan(req);
    return Response.json(
      { ok: false, galat: "Server sedang menerima banyak laporan. Coba kirim lagi sebentar lagi." },
      { status: 503 },
    );
  }
  j.n++;
  try {
    return await terima();
  } finally {
    j.n--;
  }
}

/**
 * Baca badan sampai habis lalu buang, potong demi potong (memori tetap kecil).
 * Jawaban yang dikirim selagi klien masih mengunggah membuat koneksinya
 * diputus, dan iOS lalu melihat galat jaringan, bukan jawabannya.
 */
export async function buangBadan(req: Request): Promise<void> {
  const pembaca = req.body?.getReader();
  try {
    while (pembaca && !(await pembaca.read()).done);
  } catch {
    /* klien memutus sendiri — tidak ada yang perlu dijawab */
  }
}
