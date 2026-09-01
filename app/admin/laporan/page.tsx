import Link from "next/link";
import { redirect } from "next/navigation";
import { bacaSesi, bolehKelola } from "@/lib/sesi";
import {
  daftarLaporan, adaStatus, NAMA_STATUS,
  type Lampiran, type StatusLaporan,
} from "@/lib/laporan-publik";
import { HALAMAN, KopHalaman } from "../kop-halaman";
import { Paginasi } from "../paginasi";
import { TombolVerifikasi } from "./tombol-verifikasi";

export const dynamic = "force-dynamic";

const PER_HALAMAN = 15;

const waktu = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
});

/** Saringan status. "Menunggu" duluan dan jadi bawaan: halaman ini dibuka untuk
 *  mengosongkan antrean, bukan untuk membaca arsip. */
const SARINGAN: { nilai: string; label: string }[] = [
  { nilai: "pending", label: "Menunggu" },
  { nilai: "approved", label: "Terverifikasi" },
  { nilai: "rejected", label: "Ditolak" },
  { nilai: "semua", label: "Semua" },
];

/** Tepi kiri baris menurut status — sama bahasanya dengan daftar komentar. */
const TEPI: Record<StatusLaporan, string> = {
  pending: "cms-baris--perhatian",
  approved: "cms-baris--aman",
  rejected: "",
};

export default async function Laporan({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; halaman?: string }>;
}) {
  const sesi = await bacaSesi();
  if (!sesi || !bolehKelola(sesi.peran)) redirect("/admin/login");

  const params = await searchParams;
  const pilihan = params.status ?? "pending";
  const status: StatusLaporan | undefined = adaStatus(pilihan) ? pilihan : undefined;
  const halaman = Math.max(1, parseInt(params.halaman ?? "1", 10) || 1);

  const { daftar, total } = await daftarLaporan(status, halaman, PER_HALAMAN);
  const totalHalaman = Math.ceil(total / PER_HALAMAN);

  return (
    <div className={HALAMAN}>
      <KopHalaman
        mata="Verifikasi"
        judul="Laporan warga"
        catatan="Kiriman dari pengunjung situs. Tidak ada yang tampil di halaman publik sampai diverifikasi — yang lolos disalin jadi kejadian secara manual."
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <nav aria-label="Saring menurut status" className="flex flex-wrap gap-1">
          {SARINGAN.map((s) => {
            const aktif = pilihan === s.nilai;
            return (
              <Link key={s.nilai} href={`/admin/laporan?status=${s.nilai}`}
                    aria-current={aktif ? "page" : undefined}
                    className={`cms-mata rounded-[3px] px-2.5 py-1.5 transition-colors ${
                      aktif
                        ? "bg-[var(--jelaga)] text-white"
                        : "text-[var(--redup)] hover:bg-[var(--papan)]"
                    }`}>
                {s.label}
              </Link>
            );
          })}
        </nav>
        <p className="cms-angka ml-auto text-[12.5px] text-[var(--lirih)]">{total} laporan</p>
      </div>

      {daftar.length === 0 ? (
        <div className="cms-kosong">
          <p className="cms-judul text-[18px]">
            {pilihan === "pending" ? "Antrean kosong" : "Tidak ada laporan"}
          </p>
          <p className="mx-auto mt-2 max-w-[46ch] text-[13.5px] text-[var(--redup)]">
            {pilihan === "pending"
              ? "Semua kiriman warga sudah ditinjau. Laporan baru akan muncul di sini."
              : "Belum ada laporan dengan status itu."}
          </p>
        </div>
      ) : (
        <>
          <ul className="grid gap-2">
            {daftar.map((l) => (
              <li key={l.id} className={`cms-baris p-4 ${TEPI[l.status]}`}>
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Judulnya pintu ke halaman detail; saringan yang sedang
                          dibuka ikut dibawa supaya tombol kembali di sana
                          mendarat di tab yang sama. */}
                      <Link href={`/admin/laporan/${l.id}?status=${pilihan}`}
                            className="text-[15px] font-semibold underline-offset-4 hover:underline">
                        {l.judul}
                      </Link>
                      {l.status === "pending" && (
                        <span className="cms-cap cms-cap--perhatian">Menunggu</span>
                      )}
                      {l.status === "rejected" && (
                        <span className="cms-cap cms-cap--diam">Ditolak</span>
                      )}
                    </div>

                    <p className="mt-1.5 text-[13.5px] leading-[1.55] whitespace-pre-line text-[var(--jelaga)]">
                      {l.deskripsi}
                    </p>

                    <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1
                                    text-[12px] text-[var(--lirih)]">
                      <span className="cms-angka">{l.dibuat ? waktu.format(l.dibuat) : "—"}</span>
                      {/* Anonim ditulis apa adanya. Membiarkannya kosong membuat
                          baris ini terbaca seolah namanya hilang, padahal itu
                          pilihan pelapor. */}
                      <span className={l.namaPelapor ? "" : "italic"}>
                        {l.namaPelapor ?? "Anonim"}
                      </span>
                      {l.lat !== null && l.lng !== null && (
                        <a href={`https://www.google.com/maps?q=${l.lat},${l.lng}`}
                           target="_blank" rel="noreferrer"
                           className="cms-angka underline-offset-4 hover:underline">
                          {l.lat.toFixed(5)}, {l.lng.toFixed(5)} ↗
                        </a>
                      )}
                      {l.ip && <span className="cms-angka">{l.ip}</span>}
                      {l.status !== "pending" && l.ditinjau && (
                        <span>
                          {NAMA_STATUS[l.status].toLowerCase()} {waktu.format(l.ditinjau)}
                          {l.peninjau ? ` oleh ${l.peninjau}` : ""}
                        </span>
                      )}
                    </div>

                    <Lampiran daftar={l.lampiran} judul={l.judul} />

                    <Link href={`/admin/laporan/${l.id}?status=${pilihan}`}
                          className="cms-mata mt-3 inline-block underline-offset-4 hover:underline">
                      Lihat detail →
                    </Link>
                  </div>

                  <TombolVerifikasi id={l.id} status={l.status} bolehHapus={sesi.peran === "admin"} />
                </div>
              </li>
            ))}
          </ul>

          <Paginasi
            halaman={halaman}
            totalHalaman={totalHalaman}
            totalData={total}
            perHalaman={PER_HALAMAN}
            baseUrl="/admin/laporan"
            searchParams={{ status: pilihan }}
          />
        </>
      )}
    </div>
  );
}

/**
 * Seluruh lampiran ditampilkan, bukan satu pratinjau.
 *
 * Halaman ini untuk memutuskan benar-tidaknya sebuah laporan, dan yang jadi
 * bukti justru berkas kedua dan ketiga. Gambar dibuka ukuran penuh di tab baru;
 * video diputar di tempat — route /media mendukung Range, jadi tidak perlu
 * mengunduh seluruhnya dulu untuk melompat ke tengah.
 */
function Lampiran({ daftar, judul }: { daftar: Lampiran[]; judul: string }) {
  if (daftar.length === 0) return null;

  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {daftar.map((m, i) =>
        m.jenis === "gambar" ? (
          <li key={m.url}>
            <a href={m.url} target="_blank" rel="noreferrer"
               className="block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--api)]">
              <img src={m.url} alt={`Lampiran ${i + 1} — ${judul}`} loading="lazy"
                   className="h-24 w-32 rounded-[3px] border border-[var(--garis)] object-cover" />
            </a>
          </li>
        ) : (
          <li key={m.url}>
            <video src={m.url} controls preload="none"
                   className="h-24 w-32 rounded-[3px] border border-[var(--garis)] bg-black object-cover" />
          </li>
        ),
      )}
    </ul>
  );
}
