import { wajibSesi } from "@/lib/sesi";
import { ambilSorotan } from "@/lib/statistik-sorotan";
import { HALAMAN, KopHalaman } from "../kop-halaman";
import { FormSorotan } from "./form-sorotan";

export default async function Statistik() {
  await wajibSesi();

  const awal = await ambilSorotan();

  return (
    <div className={HALAMAN}>
      <KopHalaman
        mata="Konten"
        judul="Angka sorotan karhutla"
      />
      <FormSorotan awal={awal} />
    </div>
  );
}
