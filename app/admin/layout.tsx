import type { Metadata } from "next";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import { IBM_Plex_Mono, IBM_Plex_Sans, IBM_Plex_Sans_Condensed } from "next/font/google";
import { prisma } from "@/lib/prisma";
import { bacaSesi } from "@/lib/sesi";
import { hitungMenunggu } from "@/lib/laporan-publik";
import { MenuAdmin, MenuAdminAtas } from "./menu-admin";
import { keluar } from "./aksi-sesi";
import "./cms.css";

/* Poppins ditinggal di panggung publik. CMS ini alat baca-tulis data, dan
   Plex dipilih justru karena tiga peran huruf yang dibutuhkannya datang dari
   satu keluarga: padat untuk label papan jaga, biasa untuk badan tulisan,
   monospace untuk angka yang harus sejajar antar baris. */
const padat = IBM_Plex_Sans_Condensed({
  subsets: ["latin"], weight: ["600", "700"], variable: "--huruf-padat",
});
const badan = IBM_Plex_Sans({
  subsets: ["latin"], weight: ["400", "500", "600"],
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"], weight: ["400", "500"], variable: "--huruf-mono",
});

export const metadata: Metadata = {
  title: "CMS Pasopati Fire",
  description: "Panel admin pengelolaan pantauan karhutla Indonesia.",
};

const ambilTunggakan = unstable_cache(
  async () => {
    const [belumDitinjau, laporanMenunggu] = await Promise.all([
      prisma.comments.count({
        where: { commentable_type: "App\\Models\\Event", is_approved: false },
      }),
      hitungMenunggu(),
    ]);
    return { belumDitinjau, laporanMenunggu };
  },
  ["admin-tunggakan"],
  { revalidate: 15, tags: ["tunggakan"] }
);

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const sesi = await bacaSesi();

  // Halaman masuk ikut berada di bawah /admin, jadi ia juga melewati layout ini.
  // Tanpa sesi, kerangkanya tidak dipasang: pintu masuk tidak boleh memamerkan
  // menu yang belum boleh dibuka.
  if (!sesi) {
    return <div className={`cms ${badan.className} ${padat.variable} ${mono.variable}`}>{children}</div>;
  }

  // Angka yang menunggu dikerjakan ditulis di menunya sendiri; itulah hitungan
  // yang perlu dilihat editor sebelum memilih halaman. Dicache 15 detik agar
  // navigasi antar halaman CMS tidak selalu memukul database berulang kali.
  const tunggakan = await ambilTunggakan();

  return (
    <div className={`cms ${badan.className} ${padat.variable} ${mono.variable} min-h-screen`}>
      <div className="flex min-h-screen flex-col lg:flex-row">
        {/* Tulang punggung — tetap di tempat selama isinya digulir. */}
        <aside className="cms-punggung sticky top-0 z-20 hidden w-[236px] shrink-0 flex-col
                          self-start lg:flex lg:h-screen">
          <Kop />
          <div className="mt-6 flex-1">
            <MenuAdmin tunggakan={tunggakan} peran={sesi.peran} />
          </div>
          <Kaki nama={sesi.nama} peran={sesi.peran} />
        </aside>

        {/* Kerangka sempit: kepala tetap di atas, menunya digulir mendatar. */}
        <div className="cms-punggung sticky top-0 z-20 lg:hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <Kop rapat />
            <div className="flex items-center gap-3">
              <span className="cms-angka text-[12px] text-[#a8a79c]">{sesi.nama}</span>
              <TombolKeluar />
            </div>
          </div>
          <MenuAdminAtas tunggakan={tunggakan} peran={sesi.peran} />
        </div>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

function Kop({ rapat = false }: { rapat?: boolean }) {
  return (
    <Link href="/admin" className={`block ${rapat ? "" : "border-b border-white/10 px-4 py-5"}`}>
      <span className="cms-judul block text-[19px] leading-none text-white">
        Pasopati<span className="text-[var(--api)]">.</span>Fire
      </span>
      {!rapat && (
        <span className="cms-mata mt-2 block text-[#78776d]">Meja jaga karhutla</span>
      )}
    </Link>
  );
}

function Kaki({ nama, peran }: { nama: string; peran: string }) {
  return (
    <div className="border-t border-white/10 px-4 py-4">
      <p className="text-[13px] font-medium text-[#e8e7de]">{nama}</p>
      <p className="cms-mata mt-0.5 text-[#78776d]">{peran}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a href="/" target="_blank" rel="noreferrer"
           className="cms-mata text-[#a8a79c] underline-offset-4 hover:text-white hover:underline">
          Lihat situs ↗
        </a>
      </div>
      <div className="mt-3">
        <TombolKeluar lebar />
      </div>
    </div>
  );
}

function TombolKeluar({ lebar = false }: { lebar?: boolean }) {
  return (
    <form action={keluar}>
      <button type="submit"
              className={`cms-tombol cms-tombol--sunyi cms-tombol--kecil ${lebar ? "w-full" : ""}`}>
        Keluar
      </button>
    </form>
  );
}
