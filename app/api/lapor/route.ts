import { revalidatePath } from "next/cache";
import { lewatBatas } from "@/lib/batas-laju";
import { bergiliran, buangBadan, tolakUkuran } from "@/lib/batas-laporan";
import { simpanLaporanPublik } from "@/lib/laporan-publik";
import { buatTiket, pakaiTiket } from "@/lib/tiket-lapor";
import { ipDari } from "@/lib/turnstile";

/**
 * POST /api/lapor (multipart) — laporan warga dari form web (/lapor dan
 * komposer di beranda). Menjawab HasilLapor sebagai JSON.
 *
 * Dulu server action. Next menyangga SELURUH badan server action (atap
 * bodySizeLimit) — dan proxy.ts ikut menyangga badan di semua path yang
 * dicocokkannya — sebelum batas laju dan captcha sempat berjalan: belasan
 * kiriman 100 MB tanpa captcha cukup untuk membuat container 2 GB mati OOM.
 * Route handler di bawah /api (dilewati matcher proxy) jalan begitu header
 * tiba, jadi semua yang bisa diputuskan dari header diputuskan dulu:
 * ukuran → batas laju → tiket captcha (header `X-Tiket-Lapor`, hasil
 * mintaTiketLapor) → jatah serentak yang sama dengan rute mobile.
 */
export async function POST(req: Request) {
  const kebesaran = tolakUkuran(req, true);
  if (kebesaran) return kebesaran;

  // Captcha bukan satu-satunya gerbang: kebun pemecah captcha bisa mengisi
  // MinIO 100 MB per kiriman. 5 laporan / 10 menit / IP cukup untuk warga
  // yang melapor beruntun. Tanpa IP tepercaya (TRUSTED_PROXY_HOPS) tidak
  // dibatasi — IP palsu dari header bisa membuat warga lain terkunci.
  // Penolakan dini membuang badannya dulu supaya pesannya sampai ke peramban.
  const ip = ipDari(req);
  if (ip && (await lewatBatas(`lapor:${ip}`, 5, 600))) {
    await buangBadan(req);
    return Response.json(
      { ok: false, galat: "Terlalu banyak laporan dari jaringan ini. Coba lagi dalam 10 menit." },
      { status: 429 },
    );
  }

  if (!(await pakaiTiket(req.headers.get("x-tiket-lapor")))) {
    await buangBadan(req);
    return Response.json(
      { ok: false, galat: "Verifikasi captcha gagal. Coba lagi.", bidang: "captcha" },
      { status: 422 },
    );
  }

  return bergiliran(req, async () => {
    let data: FormData;
    try {
      data = await req.formData();
    } catch {
      return Response.json({ ok: false, galat: "Kiriman tidak bisa dibaca server." }, { status: 400 });
    }
    // Tiket header sudah dipakai di atas; simpanLaporanPublik tetap satu jalur.
    data.set("tiket", buatTiket());

    const hasil = await simpanLaporanPublik(data, ip);
    if (hasil.ok) {
      revalidatePath("/[locale]", "page");
      revalidatePath("/[locale]/lapor", "page");
      // Umpan landing karhutla membaca kejadian tayang yang sama.
      revalidatePath("/[locale]/karhutla", "page");
    }
    return Response.json(hasil, { status: hasil.ok ? 200 : 422 });
  });
}
