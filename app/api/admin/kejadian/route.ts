import { revalidateTag } from "next/cache";
import { bergiliran, buangBadan, tolakUkuran } from "@/lib/batas-laporan";
import { pastikanBolehKelola } from "@/lib/sesi";
import { simpanKejadian } from "@/lib/simpan-kejadian";
import { URL_SITUS } from "@/lib/situs";

/**
 * Origin wajib ada dan sama dengan host permintaan (Host / X-Forwarded-Host,
 * seperti cek server action di Next) atau host NEXT_PUBLIC_SITE_URL.
 */
function asalSah(req: Request): boolean {
  try {
    const asal = new URL(req.headers.get("origin") ?? "").host;
    return [
      req.headers.get("host"),
      req.headers.get("x-forwarded-host")?.split(",")[0].trim(),
      new URL(URL_SITUS).host,
    ].includes(asal);
  } catch {
    return false; // tanpa Origin, atau Origin "null"
  }
}

/**
 * POST /api/admin/kejadian[?id=…] (multipart) — simpan kejadian dari form CMS:
 * tanpa id = tambah, dengan id = ubah. Menjawab HasilSimpan sebagai JSON.
 *
 * Dulu server action. Next menyangga SELURUH badan server action — dan proxy.ts
 * ikut menyalinnya — sebelum sesi di dalam aksi sempat diperiksa, jadi atap
 * 101 MB itu terbuka bagi siapa saja tanpa masuk. Route handler di bawah /api
 * (dilewati matcher proxy) jalan begitu header tiba: ukuran → asal → sesi →
 * jatah serentak (dibagi dengan laporan warga), baru badannya dibaca.
 */
export async function POST(req: Request) {
  const kebesaran = tolakUkuran(req, true);
  if (kebesaran) return kebesaran;

  // Server action mendapat cek Origin dari Next; route bersesi cookie tidak.
  // Cookie SameSite=Lax sudah menahan POST lintas situs — ini lapis kedua.
  // Penolakan dini membuang badannya dulu supaya jawabannya sampai ke peramban.
  if (!asalSah(req)) {
    await buangBadan(req);
    return Response.json({ ok: false, galat: "Permintaan tidak sah." }, { status: 403 });
  }
  // Sama dengan wajibSesi() di aksi dulu; pengalihan ke /admin/login kini di form.
  if (!(await pastikanBolehKelola())) {
    await buangBadan(req);
    return Response.json({ ok: false, galat: "Masuk dulu." }, { status: 401 });
  }

  const idMentah = new URL(req.url).searchParams.get("id");
  const id = idMentah === null ? undefined : Number(idMentah);
  if (id !== undefined && !(Number.isSafeInteger(id) && id > 0)) {
    await buangBadan(req);
    return Response.json({ ok: false, galat: "Permintaan tidak sah." }, { status: 400 });
  }

  return bergiliran(req, async () => {
    let data: FormData;
    try {
      data = await req.formData();
    } catch {
      return Response.json({ ok: false, galat: "Kiriman tidak bisa dibaca server." }, { status: 400 });
    }

    const hasil = await simpanKejadian(data, id);
    // Metadata slug di halaman publik di-cache; tanpa ini pratinjau bagikan
    // kejadian bisa basi sampai cache-nya kedaluwarsa sendiri. { expire: 0 } =
    // updateTag, yang hanya boleh dipanggil dari server action.
    if (hasil.ok) revalidateTag("kejadian", { expire: 0 });
    return Response.json(hasil, { status: hasil.ok ? 200 : 422 });
  });
}
