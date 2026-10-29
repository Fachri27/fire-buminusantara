import { wajibSesi } from "@/lib/sesi";
import { daftarSiaran } from "@/lib/siaran";
import { KopPanel, LEBAR } from "../ruang";
import { POLA_RUANG, type Siaran } from "./alat";
import { PanelSiaran } from "./panel-siaran";

export default async function HalamanSiaran({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await wajibSesi();
  const [status, isi] = await daftarSiaran();
  const { ruang } = await searchParams;
  const buka = typeof ruang === "string" && POLA_RUANG.test(ruang) ? ruang : null;

  return (
    <>
      <KopPanel lebar mata="Moderasi" judul="Siaran langsung"
                deskripsi="Siaran warga dari aplikasi yang sedang berjalan — publik maupun khusus petugas. Tonton, balas lewat komentar, atau akhiri siaran yang melanggar." />
      <div className={LEBAR}>
        <PanelSiaran awal={status === 200 && Array.isArray(isi) ? (isi as Siaran[]) : []}
                     galatAwal={status === 200 ? null : String((isi as { galat?: unknown }).galat ?? "Daftar siaran gagal dimuat.")}
                     buka={buka} />
      </div>
    </>
  );
}
