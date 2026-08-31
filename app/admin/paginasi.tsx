import Link from "next/link";

type Props = {
  halaman: number;
  totalHalaman: number;
  totalData: number;
  perHalaman: number;
  baseUrl: string;
  searchParams?: Record<string, string | number | undefined>;
};

export function Paginasi({
  halaman,
  totalHalaman,
  totalData,
  perHalaman,
  baseUrl,
  searchParams = {},
}: Props) {
  if (totalHalaman <= 1) return null;

  function buatTautan(h: number) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (v !== undefined && v !== "" && k !== "halaman" && k !== "page") {
        params.set(k, String(v));
      }
    }
    if (h > 1) {
      params.set("halaman", String(h));
    }
    const qs = params.toString();
    return qs ? `${baseUrl}?${qs}` : baseUrl;
  }

  const dari = (halaman - 1) * perHalaman + 1;
  const sampai = Math.min(halaman * perHalaman, totalData);

  // Buat daftar nomor halaman dengan ellipsis cerdas (1, 2, ..., 5, 6, 7, ..., 10)
  const nomorHalaman: (number | "...")[] = [];
  for (let i = 1; i <= totalHalaman; i++) {
    if (
      i === 1 ||
      i === totalHalaman ||
      (i >= halaman - 1 && i <= halaman + 1)
    ) {
      nomorHalaman.push(i);
    } else if (
      nomorHalaman[nomorHalaman.length - 1] !== "..."
    ) {
      nomorHalaman.push("...");
    }
  }

  return (
    <nav
      aria-label="Paginasi halaman"
      className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--garis)] pt-4"
    >
      <p className="cms-angka text-[12.5px] text-[var(--redup)]">
        Menampilkan <span className="font-semibold text-[var(--jelaga)]">{dari}–{sampai}</span> dari{" "}
        <span className="font-semibold text-[var(--jelaga)]">{totalData}</span> data
      </p>

      <div className="flex items-center gap-1">
        {/* Tombol Sebelumnya */}
        {halaman > 1 ? (
          <Link
            href={buatTautan(halaman - 1)}
            className="cms-tombol cms-tombol--garis cms-tombol--kecil"
            aria-label="Halaman sebelumnya"
          >
            ← Sebelumnya
          </Link>
        ) : (
          <span
            className="cms-tombol cms-tombol--garis cms-tombol--kecil cursor-not-allowed opacity-40"
            aria-disabled="true"
          >
            ← Sebelumnya
          </span>
        )}

        {/* Angka Halaman */}
        <div className="hidden items-center gap-1 px-1 sm:flex">
          {nomorHalaman.map((item, idx) => {
            if (item === "...") {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="select-none px-2 text-[13px] text-[var(--lirih)]"
                >
                  …
                </span>
              );
            }

            const aktif = item === halaman;
            return aktif ? (
              <span
                key={item}
                aria-current="page"
                className="cms-angka grid size-8 place-items-center rounded-[3px] bg-[var(--jelaga)] text-[13px] font-bold text-white shadow-xs"
              >
                {item}
              </span>
            ) : (
              <Link
                key={item}
                href={buatTautan(item)}
                className="cms-angka grid size-8 place-items-center rounded-[3px] border border-[var(--garis-tegas)] bg-[var(--papan)] text-[13px] font-medium text-[var(--jelaga)] hover:bg-white"
              >
                {item}
              </Link>
            );
          })}
        </div>

        {/* Tombol Selanjutnya */}
        {halaman < totalHalaman ? (
          <Link
            href={buatTautan(halaman + 1)}
            className="cms-tombol cms-tombol--garis cms-tombol--kecil"
            aria-label="Halaman selanjutnya"
          >
            Selanjutnya →
          </Link>
        ) : (
          <span
            className="cms-tombol cms-tombol--garis cms-tombol--kecil cursor-not-allowed opacity-40"
            aria-disabled="true"
          >
            Selanjutnya →
          </span>
        )}
      </div>
    </nav>
  );
}
