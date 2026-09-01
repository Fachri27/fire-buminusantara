import { HALAMAN } from "./kop-halaman";

export default function LoadingAdmin() {
  return (
    <div className={HALAMAN} aria-busy="true" aria-label="Memuat data...">
      {/* Kop Halaman Skeleton */}
      <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-b border-[var(--garis)] pb-5">
        <div className="min-w-0 space-y-2">
          <div className="cms-skeleton h-3 w-24" />
          <div className="cms-skeleton h-7 w-48" />
          <div className="cms-skeleton h-4 w-72" />
        </div>
        <div className="cms-skeleton h-9 w-32" />
      </header>

      {/* Saringan / Toolbar Skeleton */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <div className="cms-skeleton h-9 w-44" />
          <div className="cms-skeleton h-9 w-20" />
        </div>
        <div className="cms-skeleton h-4 w-20" />
      </div>

      {/* Daftar Baris Skeleton */}
      <div className="grid gap-2.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="cms-baris flex items-center gap-4 p-3.5"
          >
            <div className="cms-skeleton h-12 w-16 shrink-0" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="cms-skeleton h-4 w-3/5" />
              <div className="cms-skeleton h-3 w-2/5" />
            </div>
            <div className="cms-skeleton hidden h-6 w-16 sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
