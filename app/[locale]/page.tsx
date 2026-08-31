import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ambilBerita, hitungLaporanProvinsi } from "@/lib/events";
import { ambilTigaTeratas } from "@/lib/wms";
import { HalamanFire } from "@/components/halaman-fire";
import { Nav } from "@/components/nav";
import { adaBahasa, type Bahasa } from "@/lib/bahasa";

// Kejadian ditambahkan lewat CMS Laravel, di luar pengetahuan Next.js, jadi
// halaman ini tidak boleh di-cache statis.
export const dynamic = "force-dynamic";

// Dua prefiks yang sah — /id dan /en. Segmen lain (mis. /xyz) ditolak
// lewat notFound() di bawah.
export function generateStaticParams() {
  return [{ locale: "id" }, { locale: "en" }];
}

// Isi halaman dipisah dari kerangkanya supaya kerangka — Nav — terstream
// seketika, sementara data di bawah ini masih diambil. Tanpa pemisahan ini
// HTML baru tiba setelah seluruh kueri selesai dan pengunjung menatap
// layar kosong selama itu.
async function IsiHalaman({ bahasa }: { bahasa: Bahasa }) {
  const [berita, jumlahLaporan, tigaTeratas] = await Promise.all([
    ambilBerita(),
    hitungLaporanProvinsi(),
    ambilTigaTeratas(),
  ]);

  return (
    <HalamanFire
      berita={berita}
      jumlahLaporan={jumlahLaporan}
      tigaTeratas={tigaTeratas}
      bahasa={bahasa}
    />
  );
}

export default async function Halaman({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params;
  if (!adaBahasa(locale)) notFound();

  return (
    <>
      {/* ponytail: <html lang> di layout akar tidak bisa membaca segmen [locale]
          tanpa memindahkan seluruh struktur — Nav yang membetulkannya di sisi
          klien; pindahkan layout akar ke [locale] kalau rasa bahasa halaman
          perlu benar sejak byte pertama (SEO). */}
      <Nav bahasa={locale as Bahasa} />
      <h1 className="sr-only">Pantauan kebakaran hutan dan lahan Indonesia</h1>
      <Suspense fallback={null}>
        <IsiHalaman bahasa={locale as Bahasa} />
      </Suspense>
    </>
  );
}
