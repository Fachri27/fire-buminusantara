import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { wajibSesi } from "@/lib/sesi";
import { daftarSiaran } from "@/lib/siaran";
import { bacaSaring, halamanDari } from "../saring";
import { KopPanel, LEBAR, Tabel } from "../ruang";
import { KendaliSaring, PagerDaftar } from "../ruang-klien";
import { AksiLaporanKonten } from "./tombol-aksi";

const PER = 20;
const waktu = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** content_reports.jenis — "laporan" = kejadian di umpan aplikasi (target = events.id). */
const JENIS = { komentar: "Komentar", laporan: "Kejadian", siaran: "Siaran langsung" } as const;
type Jenis = keyof typeof JENIS;

/** Sama dengan ALASAN_LAPORAN di aplikasi (src/lib/laporkan.ts), versi pendek. */
const ALASAN: Record<string, string> = {
  palsu: "Informasi palsu",
  "tidak-pantas": "Tidak pantas",
  kebencian: "Ujaran kebencian",
  spam: "Spam / penipuan",
  bahaya: "Membahayakan / data pribadi",
  lainnya: "Lainnya",
};

/** target_id datang apa adanya dari aplikasi — hanya angka yang dicari di DB. */
const ID_SAH = /^\d{1,15}$/;

type SiaranHidup = { ruang: string; judul: string; nama: string };

export default async function LaporanKonten() {
  await wajibSesi();
  const saring = await bacaSaring("laporan-konten");
  const jenis = Object.hasOwn(JENIS, saring.jenis ?? "") ? (saring.jenis as Jenis) : undefined;

  // Satu baris per konten (bukan per laporan), yang terakhir dilaporkan dulu.
  const semua = await prisma.content_reports.groupBy({
    by: ["jenis", "target_id"],
    where: { status: "baru", ...(jenis ? { jenis } : {}) },
    _max: { created_at: true },
    orderBy: { _max: { created_at: "desc" } },
  });
  const halaman = halamanDari(saring, semua.length, PER);
  const kelompok = semua.slice((halaman - 1) * PER, halaman * PER);

  const laporan = kelompok.length
    ? await prisma.content_reports.findMany({
        where: { status: "baru", OR: kelompok.map((k) => ({ jenis: k.jenis, target_id: k.target_id })) },
        orderBy: { created_at: "desc" },
        select: { jenis: true, target_id: true, alasan: true, catatan: true, reporter_user_id: true, ip_address: true },
      })
    : [];

  // Konteks: isi komentar, judul kejadian, siaran yang masih berlangsung.
  const idDari = (j: Jenis) => [...new Set(kelompok.filter((k) => k.jenis === j && ID_SAH.test(k.target_id)).map((k) => k.target_id))].map(BigInt);
  const idKomentar = idDari("komentar");
  const [komentar, jawabanSiaran] = await Promise.all([
    idKomentar.length
      ? prisma.comments.findMany({
          where: { id: { in: idKomentar } },
          select: { id: true, name: true, body: true, is_approved: true, commentable_id: true },
        })
      : Promise.resolve([]),
    kelompok.some((k) => k.jenis === "siaran") ? daftarSiaran() : Promise.resolve(null),
  ]);
  const idKejadian = [...new Set([...idDari("laporan"), ...komentar.flatMap((c) => (c.commentable_id !== null ? [c.commentable_id] : []))])];
  const kejadian = idKejadian.length
    ? await prisma.events.findMany({ where: { id: { in: idKejadian } }, select: { id: true, title_id: true, status: true } })
    : [];
  const petaKomentar = new Map(komentar.map((c) => [String(c.id), c]));
  const petaKejadian = new Map(kejadian.map((e) => [String(e.id), e]));
  // null = server siaran tidak bisa ditanya; status siarannya tidak diketahui.
  const siaranHidup = jawabanSiaran?.[0] === 200 && Array.isArray(jawabanSiaran[1])
    ? new Map((jawabanSiaran[1] as SiaranHidup[]).map((s) => [s.ruang, s]))
    : null;

  const daftar = kelompok.map((k) => {
    const milik = laporan.filter((l) => l.jenis === k.jenis && l.target_id === k.target_id);
    // Ambang sembunyi otomatis menghitung akun berbeda; tamu dihitung per IP.
    const akun = new Set(milik.flatMap((l) => (l.reporter_user_id !== null ? [String(l.reporter_user_id)] : [])));
    const tamu = new Set(milik.filter((l) => l.reporter_user_id === null).map((l, i) => l.ip_address ?? `tanpa-ip-${i}`));
    const alasan = new Map<string, number>();
    for (const l of milik) alasan.set(l.alasan, (alasan.get(l.alasan) ?? 0) + 1);
    return {
      jenis: k.jenis as Jenis,
      target: k.target_id,
      terakhir: k._max.created_at,
      akun: akun.size,
      tamu: tamu.size,
      alasan: [...alasan].sort((a, b) => b[1] - a[1]),
      catatan: milik.flatMap((l) => (l.catatan ? [l.catatan] : [])),
    };
  });

  return (
    <>
      <KopPanel lebar mata="Moderasi" judul="Laporan konten"
                deskripsi="Komentar, kejadian, dan siaran yang dilaporkan pengguna aplikasi. Komentar yang dilaporkan tiga akun berbeda disembunyikan otomatis sambil menunggu keputusan di sini." />
      <div className={LEBAR}>
        <KendaliSaring bagian="laporan-konten" nilai={saring}
                       tab={{ kunci: "jenis", bawaan: "", pilihan: [
                         { nilai: "", label: "Semua" },
                         ...Object.entries(JENIS).map(([nilai, label]) => ({ nilai, label })),
                       ] }} />
        <Tabel
          kepala={<>
            <th>Konten</th>
            <th className="hidden md:table-cell">Alasan & catatan</th>
            <th>Pelapor</th>
            <th className="hidden sm:table-cell">Terakhir</th>
          </>}
          kosong={daftar.length === 0 && (jenis ? `Tidak ada laporan ${JENIS[jenis].toLowerCase()} yang menunggu.` : "Antrean kosong — tidak ada laporan yang menunggu.")}
          kaki={<PagerDaftar bagian="laporan-konten" nilai={saring} halaman={halaman} total={semua.length} per={PER} />}
        >
          {daftar.map((d) => {
            const c = d.jenis === "komentar" ? petaKomentar.get(d.target) : undefined;
            const e = d.jenis === "laporan" ? petaKejadian.get(d.target)
              : c?.commentable_id != null ? petaKejadian.get(String(c.commentable_id)) : undefined;
            const s = d.jenis === "siaran" ? siaranHidup?.get(d.target) : undefined;
            const alasan = d.alasan.map(([a, n]) => `${ALASAN[a] ?? a}${n > 1 ? ` ×${n}` : ""}`).join(", ");
            return (
              <tr key={`${d.jenis}:${d.target}`} data-perhatian={d.akun >= 3 || undefined}>
                <td className="min-w-[240px] max-w-[460px] align-top">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="cms-cap cms-cap--diam">{JENIS[d.jenis] ?? d.jenis}</span>
                    {c && (c.is_approved
                      ? <span className="cms-cap cms-cap--aman cms-cap--titik">Tampil</span>
                      : <span className="cms-cap cms-cap--perhatian cms-cap--titik">Disembunyikan</span>)}
                    {d.jenis === "laporan" && e && e.status !== "published" && <span className="cms-cap cms-cap--diam cms-cap--titik">Draf</span>}
                    {d.jenis === "siaran" && (s ? <span className="cms-cap cms-cap--perhatian cms-cap--titik">Masih berlangsung</span>
                      : siaranHidup ? <span className="cms-cap cms-cap--diam cms-cap--titik">Sudah berakhir</span> : null)}
                  </span>

                  {d.jenis === "komentar" && (c ? (
                    <>
                      <Link href={`/admin/komentar/${c.id}`} className="mt-1.5 line-clamp-3 [overflow-wrap:anywhere] hover:underline">{c.body}</Link>
                      <span className="mt-0.5 block text-[12px] text-[var(--lirih)]">
                        {c.name ?? "Tanpa nama"}{e && <> · pada {e.title_id}</>}
                      </span>
                    </>
                  ) : <span className="mt-1.5 block text-[var(--lirih)]">Komentar sudah dihapus.</span>)}

                  {d.jenis === "laporan" && (e ? (
                    <Link href={`/admin/kejadian/${e.id}`} className="mt-1.5 line-clamp-2 font-medium [overflow-wrap:anywhere] hover:underline">{e.title_id}</Link>
                  ) : <span className="mt-1.5 block text-[var(--lirih)]">Kejadian tidak ditemukan.</span>)}

                  {d.jenis === "siaran" && (s ? (
                    <>
                      <Link href={`/admin/siaran?ruang=${encodeURIComponent(s.ruang)}`} className="mt-1.5 line-clamp-2 font-medium [overflow-wrap:anywhere] hover:underline">{s.judul}</Link>
                      <span className="mt-0.5 block text-[12px] text-[var(--lirih)]">{s.nama} · tonton untuk menilai</span>
                    </>
                  ) : (
                    <span className="mt-1.5 block text-[12.5px] text-[var(--lirih)]">
                      {siaranHidup ? "Ruangnya sudah ditutup; isinya tidak direkam." : "Status siaran tidak diketahui — server siaran tidak bisa dihubungi."}
                    </span>
                  ))}

                  <span className="cms-angka mt-1 block truncate text-[11.5px] text-[var(--lirih)]" title={d.target}>{d.target}</span>
                  <p className="mt-1.5 text-[12.5px] text-[var(--redup)] md:hidden">{alasan}</p>

                  <AksiLaporanKonten jenis={d.jenis} target={d.target}
                                     komentarTampil={c ? c.is_approved : null} siaranHidup={Boolean(s)} />
                </td>
                <td className="hidden max-w-[320px] align-top md:table-cell">
                  <p className="text-[var(--redup)]">{alasan}</p>
                  {d.catatan.length > 0 && (
                    <ul className="mt-1.5 grid gap-1 text-[12.5px] text-[var(--lirih)]">
                      {d.catatan.slice(0, 3).map((t, i) => (
                        <li key={i} className="line-clamp-3 whitespace-pre-line [overflow-wrap:anywhere]">“{t}”</li>
                      ))}
                      {d.catatan.length > 3 && <li>+{d.catatan.length - 3} catatan lain</li>}
                    </ul>
                  )}
                </td>
                <td className="whitespace-nowrap align-top tabular-nums">
                  {d.akun > 0 && <span className="block">{d.akun} akun</span>}
                  {d.tamu > 0 && <span className="block text-[var(--lirih)]">{d.tamu} tamu</span>}
                </td>
                <td className="hidden whitespace-nowrap align-top text-[var(--redup)] tabular-nums sm:table-cell">
                  {d.terakhir ? waktu.format(d.terakhir) : "—"}
                </td>
              </tr>
            );
          })}
        </Tabel>
      </div>
    </>
  );
}
