import { redirect } from "next/navigation";
import { masuk } from "@/lib/auth";
import { bacaSesi, buatSesi } from "@/lib/sesi";
import { ambilTigaTeratas } from "@/lib/wms";
import { bacaNusantara, PetaNusantara } from "../peta-nusantara";

export const dynamic = "force-dynamic";

export default async function Masuk({
  searchParams,
}: {
  searchParams: Promise<{ galat?: string }>;
}) {
  if (await bacaSesi()) redirect("/admin/kejadian");

  // Peta dibaca dari berkas, angkanya dari layanan yang sama dengan peta publik
  // (ter-cache sejam, dan mengembalikan daftar kosong kalau tak terjangkau).
  // Keduanya tidak menahan pintu: kalau gagal, yang hilang cuma sorotannya.
  const [{ galat }, nusantara, teratas] = await Promise.all([
    searchParams,
    bacaNusantara(),
    ambilTigaTeratas(),
  ]);
  const puncak = teratas[0] ?? null;

  async function kirim(data: FormData) {
    "use server";
    const sesi = await masuk(
      String(data.get("email") ?? "").trim(),
      String(data.get("sandi") ?? ""),
    );
    // Pesan yang sama untuk email tak dikenal, sandi salah, maupun peran yang
    // tidak berhak — supaya tidak bisa dipakai menebak akun mana yang ada.
    if (!sesi) redirect("/admin/login?galat=1");
    await buatSesi(sesi);
    redirect("/admin/kejadian");
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.05fr_minmax(400px,0.95fr)]">
      {/* Pintu masuk memperlihatkan yang dijaga: seluruh Nusantara sebagai garis
          rambut, dengan provinsi dengan kebakaran terluas menyala satu-satunya. */}
      <section className="cms-punggung relative flex min-h-[260px] flex-col justify-between
                          overflow-hidden p-6 lg:p-10">
        <p className="cms-judul relative z-10 text-[20px] text-white">
          Pasopati<span className="text-[var(--api)]">.</span>Fire
        </p>

        {/* Petanya sengaja lebih lebar dari panelnya dan terpotong di kedua tepi:
            Nusantara memang tidak muat di satu layar, dan potongan itu yang
            membuatnya terbaca sebagai wilayah, bukan ikon di tengah bidang. */}
        <PetaNusantara {...nusantara} sorot={puncak?.nama}
                       className="absolute top-1/2 -left-[8%] w-[116%] -translate-y-1/2" />

        <div className="relative z-10 mt-8">
          {puncak ? (
            <>
              <p className="cms-mata text-[#78776d]">Kebakaran terluas</p>
              <p className="cms-judul mt-1.5 text-[22px] text-white">
                {puncak.nama}
              </p>
              <p className="cms-angka mt-1 text-[13px] text-[#a8a79c]">
                {puncak.luas} ha · {puncak.pulau}
              </p>
            </>
          ) : (
            <p className="cms-mata text-[#78776d]">Pantauan karhutla Indonesia</p>
          )}
        </div>
      </section>

      <section className="flex items-center justify-center p-6 lg:p-10">
        <form action={kirim} className="w-full max-w-[380px]">
          <p className="cms-mata">Meja jaga karhutla</p>
          <h1 className="cms-judul mt-2 text-[32px] leading-[1.05]">Masuk</h1>
          <p className="mt-2.5 text-[14px] text-[var(--redup)]">
            Catat kejadian lapangan dan tinjau komentar yang masuk.
          </p>

          {galat && (
            <p role="alert" className="cms-galat mt-5">
              <span aria-hidden="true" className="cms-angka font-medium">!</span>
              Email atau kata sandi tidak cocok.
            </p>
          )}

          <div className="mt-6 grid gap-4">
            <div>
              <label className="cms-mata mb-1.5 block" htmlFor="email">Email</label>
              <input id="email" name="email" type="email" required autoComplete="email"
                     autoFocus className="cms-isian w-full" />
            </div>

            <div>
              <label className="cms-mata mb-1.5 block" htmlFor="sandi">Kata sandi</label>
              <input id="sandi" name="sandi" type="password" required
                     autoComplete="current-password" className="cms-isian w-full" />
            </div>
          </div>

          <button type="submit" className="cms-tombol cms-tombol--utama mt-6 w-full">
            Masuk
          </button>

          <p className="mt-5 border-t border-[var(--garis)] pt-4 text-[12.5px] leading-[1.6] text-[var(--lirih)]">
            Akunnya sama dengan akun Pasopati. Hanya peran admin dan editor yang bisa
            membuka meja jaga.
          </p>
        </form>
      </section>
    </main>
  );
}
