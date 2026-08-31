"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TAUTAN: { href: string; label: string; tepat?: boolean; admin?: boolean }[] = [
  { href: "/admin", label: "Ringkasan", tepat: true },
  { href: "/admin/kejadian", label: "Kejadian" },
  { href: "/admin/komentar", label: "Komentar", tepat: true },
  { href: "/admin/komentar/reaksi", label: "Reaksi" },
  { href: "/admin/pengguna", label: "Pengguna", admin: true },
];

/** Halaman mana yang sedang dibuka. "Komentar" dan "Reaksi" berbagi awalan
 *  jalur, jadi yang pertama harus dicocokkan persis — tanpa itu keduanya
 *  menyala bersamaan saat halaman reaksi dibuka. */
function sedangDibuka(jalur: string, t: (typeof TAUTAN)[number]) {
  return t.tepat ? jalur === t.href : jalur.startsWith(t.href);
}

/** Tautan yang berhak dilihat sesi ini — "Pengguna" hanya untuk admin. */
function tautannya(peran: string) {
  return TAUTAN.filter((t) => !t.admin || peran === "admin");
}

/** Angka pekerjaan yang menunggu. Ditulis di sebelah menunya supaya editor tahu
 *  ada yang perlu dikerjakan tanpa membuka halamannya lebih dulu. */
function Tunggak({ jumlah, terang }: { jumlah: number; terang: boolean }) {
  if (!jumlah) return null;
  return (
    <span className={`cms-angka ml-auto rounded-[3px] px-1.5 text-[11px] leading-[18px] ${
      terang ? "bg-[var(--api)] text-white" : "bg-[var(--api)]/15 text-[var(--bara)]"
    }`}>
      {jumlah}
    </span>
  );
}

export function MenuAdmin({ belumDitinjau, peran }: { belumDitinjau: number; peran: string }) {
  const jalur = usePathname();

  return (
    <nav aria-label="Bagian CMS" className="flex flex-col">
      {tautannya(peran).map((t) => {
        const aktif = sedangDibuka(jalur, t);
        return (
          <Link key={t.href} href={t.href} aria-current={aktif ? "page" : undefined}
                className="cms-tautan">
            {t.label}
            {t.href === "/admin/komentar" && <Tunggak jumlah={belumDitinjau} terang />}
          </Link>
        );
      })}
    </nav>
  );
}

export function MenuAdminAtas({ belumDitinjau, peran }: { belumDitinjau: number; peran: string }) {
  const jalur = usePathname();

  return (
    <nav aria-label="Bagian CMS"
         className="tanpa-bilah-gulir flex gap-1 overflow-x-auto border-t border-white/10 px-2 py-1.5">
      {tautannya(peran).map((t) => {
        const aktif = sedangDibuka(jalur, t);
        return (
          <Link key={t.href} href={t.href} aria-current={aktif ? "page" : undefined}
                className={`cms-mata shrink-0 rounded-[3px] px-2.5 py-1.5 whitespace-nowrap transition-colors ${
                  aktif ? "bg-[var(--limau)] text-[var(--jelaga)]" : "text-[#a8a79c] hover:text-white"
                }`}>
            {t.label}
            {t.href === "/admin/komentar" && belumDitinjau > 0 && (
              <span className="cms-angka ml-1.5 text-[11px]">({belumDitinjau})</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
