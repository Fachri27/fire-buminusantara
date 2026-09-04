"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { rapikanLokasi, inferProvinsi } from "@/lib/wilayah";
import { bacaBerkasMedia } from "@/lib/media";
import { Pratinjau } from "../pratinjau";

export type ItemKejadian = {
  id: number;
  title_id: string;
  slug: string | null;
  event_date: string;
  location: string;
  image_id: string | null;
  video: string | null;
  media: unknown;
  orientation: string;
};

const tanggalId = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function DaftarTampilan({ daftar }: { daftar: ItemKejadian[] }) {
  // Selalu "list" pada render pertama: server tidak punya localStorage,
  // sedangkan membaca localStorage di inisialisasi state membuat klien yang
  // pernah memilih "card" me-render pohon berbeda dari server → hydration
  // failed di /admin/kejadian. Pilihan tersimpan diselaraskan di efek bawah
  // (setelah hidrasi); nilainya sama ("list") berarti React melewatkannya
  // tanpa render ulang.
  const [mode, setMode] = useState<"list" | "card">("list");

  useEffect(() => {
    try {
      const tersimpan = localStorage.getItem("cms_kejadian_tampilan");
      // Sinkronisasi pasca-hidrasi yang disengaja (pola resmi React untuk
      // nilai khusus-klien seperti localStorage): render pertama harus sama
      // dengan server, pilihan tersimpan diterapkan setelahnya.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (tersimpan === "list" || tersimpan === "card") setMode(tersimpan);
    } catch {
      // Abaikan jika localStorage tidak dapat diakses
    }
  }, []);

  function gantiMode(m: "list" | "card") {
    setMode(m);
    try {
      localStorage.setItem("cms_kejadian_tampilan", m);
    } catch {
      // Abaikan jika localStorage tidak tersedia
    }
  }

  return (
    <div>
      {/* Pengalih Tampilan List vs Card */}
      <div className="mb-4 flex items-center justify-end gap-1.5">
        <span className="cms-mata mr-1.5 text-[11px] text-[var(--lirih)]">Tampilan:</span>
        <div
          role="group"
          aria-label="Pengalih mode tampilan daftar"
          className="flex items-center rounded-[3px] border border-[var(--garis-tegas)] bg-[var(--papan)] p-0.5"
        >
          <button
            type="button"
            onClick={() => gantiMode("list")}
            title="Tampilan Baris / List"
            aria-label="Tampilan List"
            aria-pressed={mode === "list"}
            className={`flex cursor-pointer items-center gap-1.5 rounded-[2px] px-2.5 py-1 text-[12px] font-semibold transition-colors ${
              mode === "list"
                ? "bg-[var(--jelaga)] text-white shadow-xs"
                : "text-[var(--redup)] hover:bg-white hover:text-[var(--jelaga)]"
            }`}
          >
            <svg viewBox="0 0 20 20" aria-hidden="true" fill="currentColor" className="size-3.5">
              <path fillRule="evenodd" d="M3 4.5A1.5 1.5 0 0 1 4.5 3h11a1.5 1.5 0 0 1 0 3h-11A1.5 1.5 0 0 1 3 4.5Zm0 5.5A1.5 1.5 0 0 1 4.5 8.5h11a1.5 1.5 0 0 1 0 3h-11A1.5 1.5 0 0 1 3 10Zm0 5.5a1.5 1.5 0 0 1 1.5-1.5h11a1.5 1.5 0 0 1 0 3h-11a1.5 1.5 0 0 1-1.5-1.5Z" clipRule="evenodd" />
            </svg>
            <span>List</span>
          </button>

          <button
            type="button"
            onClick={() => gantiMode("card")}
            title="Tampilan Kartu / Card"
            aria-label="Tampilan Card"
            aria-pressed={mode === "card"}
            className={`flex cursor-pointer items-center gap-1.5 rounded-[2px] px-2.5 py-1 text-[12px] font-semibold transition-colors ${
              mode === "card"
                ? "bg-[var(--jelaga)] text-white shadow-xs"
                : "text-[var(--redup)] hover:bg-white hover:text-[var(--jelaga)]"
            }`}
          >
            <svg viewBox="0 0 20 20" aria-hidden="true" fill="currentColor" className="size-3.5">
              <path fillRule="evenodd" d="M4.25 2A2.25 2.25 0 0 0 2 4.25v2.5A2.25 2.25 0 0 0 4.25 9h2.5A2.25 2.25 0 0 0 9 6.75v-2.5A2.25 2.25 0 0 0 6.75 2h-2.5Zm0 9A2.25 2.25 0 0 0 2 13.25v2.5A2.25 2.25 0 0 0 4.25 18h2.5A2.25 2.25 0 0 0 9 15.75v-2.5A2.25 2.25 0 0 0 6.75 11h-2.5Zm9-9A2.25 2.25 0 0 0 11 4.25v2.5A2.25 2.25 0 0 0 13.25 9h2.5A2.25 2.25 0 0 0 18 6.75v-2.5A2.25 2.25 0 0 0 15.75 2h-2.5Zm0 9A2.25 2.25 0 0 0 11 13.25v2.5A2.25 2.25 0 0 0 13.25 18h2.5A2.25 2.25 0 0 0 18 15.75v-2.5A2.25 2.25 0 0 0 15.75 11h-2.5Z" clipRule="evenodd" />
            </svg>
            <span>Card</span>
          </button>
        </div>
      </div>

      {mode === "list" ? (
        <ul className="grid gap-2">
          {daftar.map((e) => {
            const galeri = bacaBerkasMedia(e.media).length;
            const tanpaMedia = !e.image_id && !e.video && galeri === 0;
            const provinsi = inferProvinsi(e.location);
            const tgl = new Date(e.event_date);

            return (
              <li
                key={String(e.id)}
                className="cms-baris flex items-center gap-4 p-3"
              >
                <Pratinjau
                  imageId={e.image_id}
                  video={e.video}
                  media={e.media}
                  kelas="h-14 w-20 shrink-0 rounded-[3px]"
                />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Link
                      href={`/admin/kejadian/${e.id}`}
                      className="truncate text-[15px] font-semibold underline-offset-4 hover:underline"
                    >
                      {e.title_id}
                    </Link>
                    {e.video && <span className="cms-cap cms-cap--diam">Video</span>}
                    {galeri > 0 && (
                      <span className="cms-cap cms-cap--diam">
                        <span className="cms-angka">{galeri}</span> galeri
                      </span>
                    )}
                    {tanpaMedia && <span className="cms-cap cms-cap--perhatian">Tanpa media</span>}
                  </div>

                  <p className="mt-1 truncate text-[12.5px] text-[var(--redup)]">
                    <span className="cms-angka">{tanggalId.format(tgl)}</span>
                    {" · "}
                    {rapikanLokasi(e.location) ?? "tanpa lokasi"}
                    {provinsi && <span className="text-[var(--lirih)]"> · {provinsi}</span>}
                  </p>
                </div>

                <span className="cms-mata hidden shrink-0 sm:block">{e.orientation}</span>

                <Link
                  href={`/admin/kejadian/${e.id}`}
                  className="cms-tombol cms-tombol--garis cms-tombol--kecil shrink-0"
                >
                  Ubah
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {daftar.map((e) => {
            const galeri = bacaBerkasMedia(e.media).length;
            const tanpaMedia = !e.image_id && !e.video && galeri === 0;
            const provinsi = inferProvinsi(e.location);
            const tgl = new Date(e.event_date);

            return (
              <article
                key={String(e.id)}
                className="cms-baris flex flex-col justify-between overflow-hidden rounded-[3px] p-0"
              >
                <div>
                  {/* Pratinjau Gambar / Video Utama */}
                  <div className="relative aspect-[16/10] w-full overflow-hidden border-b border-[var(--garis)] bg-[var(--kertas)]">
                    <Pratinjau
                      imageId={e.image_id}
                      video={e.video}
                      media={e.media}
                      kelas="h-full w-full object-cover"
                    />
                    <div className="absolute top-2 right-2 flex flex-wrap gap-1">
                      {e.video && <span className="cms-cap cms-cap--diam bg-white/90 shadow-xs">Video</span>}
                      {galeri > 0 && (
                        <span className="cms-cap cms-cap--diam bg-white/90 shadow-xs">
                          <span className="cms-angka">{galeri}</span> galeri
                        </span>
                      )}
                      {tanpaMedia && (
                        <span className="cms-cap cms-cap--perhatian bg-white/90 shadow-xs">
                          Tanpa media
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Isi Konten Kartu */}
                  <div className="p-3.5">
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span className="cms-angka text-[12px] text-[var(--redup)]">
                        {tanggalId.format(tgl)}
                      </span>
                      <span className="cms-mata text-[10px]">{e.orientation}</span>
                    </div>

                    <Link
                      href={`/admin/kejadian/${e.id}`}
                      className="line-clamp-2 text-[14.5px] leading-snug font-semibold underline-offset-4 hover:underline"
                      title={e.title_id}
                    >
                      {e.title_id}
                    </Link>

                    <p
                      className="mt-2 truncate text-[12px] text-[var(--redup)]"
                      title={rapikanLokasi(e.location) ?? ""}
                    >
                      {rapikanLokasi(e.location) ?? "tanpa lokasi"}
                      {provinsi && <span className="text-[var(--lirih)]"> · {provinsi}</span>}
                    </p>
                  </div>
                </div>

                {/* Footer Kartu */}
                <div className="flex items-center justify-between border-t border-[var(--garis)] bg-[var(--papan)] px-3.5 py-2.5">
                  <span className="cms-angka text-[11.5px] text-[var(--lirih)]">
                    ID #{String(e.id).padStart(3, "0")}
                  </span>
                  <Link
                    href={`/admin/kejadian/${e.id}`}
                    className="cms-tombol cms-tombol--garis cms-tombol--kecil"
                  >
                    Ubah
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
