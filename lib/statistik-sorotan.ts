import { prisma } from "./prisma";
import {
  BAWAN_SOROTAN, KUNCI_SOROTAN, LABEL_SOROTAN,
  type KunciSorotan,
} from "./statistik-sorotan-teks";

export { BAWAN_SOROTAN, KUNCI_SOROTAN, LABEL_SOROTAN, type KunciSorotan };

/** Cache singkat dalam-memori: angka nyaris statis (diubah manual via CMS),
 *  tak perlu menekan pool basis data di setiap muat halaman — penting di
 *  serverless yang pool-nya kecil dan dipakai bersama banyak instans. */
const KAS_TTL = 60_000;
let kas: { kedaluwarsa: number; nilai: Record<KunciSorotan, number> } | null = null;

/** Satu baris hidup (id terkecil); kosong/gagal = bawaan. TAK PERNAH
 *  melempar: galat basis data (pool habis, tabel belum migrasi, dsb) hanya
 *  berarti angka bawaan — halaman publik tidak boleh 500 karenanya. */
export async function ambilSorotan(): Promise<Record<KunciSorotan, number>> {
  if (kas && kas.kedaluwarsa > Date.now()) return kas.nilai;
  try {
    const baris = await prisma.sorotan_statistik.findFirst({ orderBy: { id: "asc" } });
    const nilai: Record<KunciSorotan, number> = baris
      ? {
          hotspot: Number(baris.hotspot),
          api_aktif: Number(baris.api_aktif),
          lahan_terbakar: Number(baris.lahan_terbakar),
          korban_ispa: Number(baris.korban_ispa),
          rugi_ekonomi: Number(baris.rugi_ekonomi),
          korban_satwa: Number(baris.korban_satwa),
        }
      : { ...BAWAN_SOROTAN };
    kas = { kedaluwarsa: Date.now() + KAS_TTL, nilai };
    return nilai;
  } catch {
    return { ...BAWAN_SOROTAN };
  }
}

/** Angka ala Indonesia ("5.000", "5,5") maupun Inggris ("5,000", "5.5"):
 *  koma selalu desimal; titik ribuan kecuali jelas desimal (1-2 digit). */
function bacaAngka(mentah: string): number | null {
  const s = mentah.trim();
  if (s === "") return null;
  let normal = s;
  if (s.includes(",")) {
    normal = s.replace(/\./g, "").replace(",", ".");
  } else if (!/^\d+\.\d{1,2}$/.test(s)) {
    normal = s.replace(/\./g, "");
  }
  const angka = Number(normal);
  return Number.isFinite(angka) ? angka : null;
}

/** Simpan dari FormData CMS. Semua kunci wajib angka ≥ 0. */
export async function simpanSorotan(
  masukan: FormData,
): Promise<{ ok: true } | { ok: false; galat: string; bidang?: KunciSorotan }> {
  const nilai = {} as Record<KunciSorotan, number>;
  for (const kunci of KUNCI_SOROTAN) {
    const angka = bacaAngka(String(masukan.get(kunci) ?? ""));
    if (angka === null || angka < 0) {
      return { ok: false, galat: `"${LABEL_SOROTAN[kunci].id}" harus angka ≥ 0.`, bidang: kunci };
    }
    nilai[kunci] = angka;
  }

  const ada = await prisma.sorotan_statistik.findFirst({ orderBy: { id: "asc" }, select: { id: true } });
  const data = { ...nilai, updated_at: new Date() };
  if (ada) {
    await prisma.sorotan_statistik.update({ where: { id: ada.id }, data });
  } else {
    await prisma.sorotan_statistik.create({ data });
  }
  kas = null;
  return { ok: true };
}
