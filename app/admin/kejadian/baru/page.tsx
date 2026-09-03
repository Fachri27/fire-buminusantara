import Link from "next/link";
import { redirect } from "next/navigation";
import { bacaSesi, bolehKelola } from "@/lib/sesi";
import { simpanKejadian } from "@/lib/simpan-kejadian";
import { HALAMAN, KopHalaman } from "../../kop-halaman";
import { FormKejadian } from "../form";

export default async function Tambah({
  searchParams,
}: {
  searchParams: Promise<{ galat?: string }>;
}) {
  const sesi = await bacaSesi();
  if (!sesi || !bolehKelola(sesi.peran)) redirect("/admin/login");

  const { galat } = await searchParams;

  async function kirim(data: FormData) {
    "use server";
    const s = await bacaSesi();
    if (!s || !bolehKelola(s.peran)) redirect("/admin/login");

    const hasil = await simpanKejadian(data);
    if (!hasil.ok) redirect(`/admin/kejadian/baru?galat=${encodeURIComponent(hasil.galat)}`);
    redirect("/admin/kejadian");
  }

  return (
    <div className={HALAMAN}>
      <Link href="/admin/kejadian" className="cms-mata mb-4 inline-block underline-offset-4 hover:underline">
        ← Kejadian
      </Link>

      <KopHalaman
        mata="Catatan baru"
        judul="Tambah kejadian"
        catatan="Judul, tanggal, lokasi, dan koordinat wajib diisi. Sisanya bisa dilengkapi belakangan."
      />

      {galat && (
        <p role="alert" className="cms-galat mb-6">
          <span aria-hidden="true" className="cms-angka font-medium">!</span>
          {galat}
        </p>
      )}

      <FormKejadian sedangUbah={false} aksi={kirim}
        awal={{
          title_id: "", title_en: "", slug: "",
          description_id: "", description_en: "",
          event_date: new Date().toISOString().slice(0, 10),
          location: "", location_lat: "", location_lng: "",
          orientation: "landscape",
          galeri: [],
        }} />
    </div>
  );
}
