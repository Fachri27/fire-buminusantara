import { bacaBerkasMedia, urlMedia } from "@/lib/media";

/**
 * Gambar / Media kecil sebuah kejadian untuk daftar CMS.
 *
 * Menampilkan berkas media asli jika ada:
 * - Foto / gambar poster utama atau foto galeri
 * - Video asli (frame pertama) jika kejadian berupa video
 * - Ikon placeholder minimalis jika belum ada media
 */
export function Pratinjau({
  imageId,
  video,
  media,
  kelas,
}: {
  imageId: string | null;
  video: string | null;
  media: unknown;
  kelas: string;
}) {
  const galeri = bacaBerkasMedia(media);

  // 1. Prioritaskan gambar poster utama, foto galeri, atau poster video
  const gambarPath =
    imageId ??
    galeri.find((b) => b.type === "image")?.path ??
    galeri.find((b) => b.type === "video" && b.poster)?.poster ??
    null;
  const urlGambar = urlMedia(gambarPath);

  if (urlGambar) {
    return (
      <img
        src={urlGambar}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        className={`${kelas} object-cover`}
      />
    );
  }

  // 2. Jika tidak ada gambar/poster, tampilkan video asli
  const videoPath = video ?? galeri.find((b) => b.type === "video")?.path ?? null;
  const urlVideo = urlMedia(videoPath);

  if (urlVideo) {
    return (
      <div className={`relative ${kelas} overflow-hidden bg-black/5`}>
        <video
          src={urlVideo}
          muted
          playsInline
          preload="none"
          className="size-full object-cover pointer-events-none"
        />
        {/* Indikator video di tengah */}
        <div
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center bg-black/15 text-white"
        >
          <div className="flex size-7 items-center justify-center rounded-full bg-black/60 shadow-xs backdrop-blur-xs">
            <svg viewBox="0 0 20 20" fill="currentColor" className="ml-0.5 size-3.5">
              <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
            </svg>
          </div>
        </div>
      </div>
    );
  }

  // 3. Tanpa media sama sekali: tampilkan placeholder visual bersih
  return (
    <div
      aria-hidden="true"
      className={`grid place-items-center bg-[var(--kertas)] text-[var(--lirih)] ${kelas}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="size-5 opacity-30"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
        />
      </svg>
    </div>
  );
}
