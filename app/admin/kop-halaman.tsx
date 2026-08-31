/** Lebar dan pias isi halaman CMS — satu nilai, dipakai semua halaman. */
export const HALAMAN = "mx-auto w-full max-w-[1080px] px-5 py-6 lg:px-10 lg:py-9";

/**
 * Kepala halaman: label jenis, nama halaman, satu kalimat penjelas, lalu aksi
 * utamanya di kanan. Garis rambut di bawahnya adalah satu-satunya pemisah —
 * di papan jaga, bagian dipisah garis, bukan kotak.
 */
export function KopHalaman({
  mata, judul, catatan, asli = false, children,
}: {
  mata: string;
  judul: string;
  catatan?: string;
  /** Judulnya tulisan orang (mis. judul kejadian), bukan nama halaman —
   *  ditampilkan apa adanya, tidak dipaksa huruf kapital. */
  asli?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4
                       border-b border-[var(--garis)] pb-5">
      <div className="min-w-0">
        <p className="cms-mata">{mata}</p>
        <h1 className={`cms-judul mt-1.5 text-[28px] leading-none ${asli ? "cms-judul--asli" : ""}`}>{judul}</h1>
        {catatan && (
          <p className="mt-2.5 max-w-[56ch] text-[13.5px] leading-[1.55] text-[var(--redup)]">
            {catatan}
          </p>
        )}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}
