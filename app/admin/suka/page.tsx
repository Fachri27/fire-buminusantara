import Link from "next/link";
import { wajibSesi } from "@/lib/sesi";
import { daftarSuka } from "@/lib/suka";
import { HALAMAN, KopHalaman } from "../kop-halaman";
import { Paginasi } from "../paginasi";

const PER_HALAMAN = 20;

const waktu = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
});

export default async function Suka({
  searchParams,
}: {
  searchParams: Promise<{ halaman?: string }>;
}) {
  await wajibSesi();

  const halaman = Math.max(1, parseInt((await searchParams).halaman ?? "1", 10) || 1);
  const { daftar, total } = await daftarSuka(halaman, PER_HALAMAN);

  return (
    <div className={HALAMAN}>
      <KopHalaman
        mata="Tanggapan pengunjung"
        judul="Suka"
        catatan="Jempol pengunjung pada kejadian di umpan, beserta alamat IP dan user agent pengirimnya."
      />

      {daftar.length === 0 ? (
        <p className="cms-kosong text-[13.5px] text-[var(--redup)]">Belum ada suka yang masuk.</p>
      ) : (
        <>
          <ul className="grid gap-2">
            {daftar.map((s) => (
              <li key={s.id} className="cms-baris p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/admin/kejadian/${s.event.id}`}
                        className="min-w-0 truncate text-[14px] font-medium underline-offset-4 hover:underline">
                    {s.event.title_id}
                  </Link>
                  <span className="cms-angka ml-auto text-[12px] text-[var(--lirih)]">
                    {s.created_at ? waktu.format(s.created_at) : "—"}
                  </span>
                </div>
                <p className="cms-angka mt-1.5 text-[12.5px]">{s.ip_address ?? "IP tidak diketahui"}</p>
                <p className="mt-0.5 break-all text-[12px] leading-[1.5] text-[var(--redup)]">
                  {s.user_agent ?? "User agent kosong"}
                </p>
              </li>
            ))}
          </ul>

          <Paginasi
            halaman={halaman}
            totalHalaman={Math.ceil(total / PER_HALAMAN)}
            totalData={total}
            perHalaman={PER_HALAMAN}
            baseUrl="/admin/suka"
          />
        </>
      )}
    </div>
  );
}
