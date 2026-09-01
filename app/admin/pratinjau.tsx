import { bacaBerkasMedia, urlMedia } from "@/lib/media";

/**
 * Gambar / Media kecil sebuah kejadian untuk daftar CMS.
 *
 * Selalu berupa gambar statis — elemen <video> tidak dipakai di sini karena
 * setiap kartu akan mengunduh metadata video hanya untuk sebuah thumbnail:
 * - Foto / gambar poster utama, foto galeri, atau poster video
 * - Placeholder ikon (play bila medianya video) jika poster tidak ada
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

  // Prioritaskan gambar poster utama, foto galeri, atau poster video
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

  // Tanpa poster sama sekali: placeholder visual bersih. Ikon play menandai
  // kejadian bermedia video — tanpa mengunduh videonya sendiri.
  const bermediaVideo = Boolean(video) || galeri.some((b) => b.type === "video");
  return (
    <div
      aria-hidden="true"
      className={`grid place-items-center bg-[var(--kertas)] text-[var(--lirih)] ${kelas}`}
    >
      {bermediaVideo ? (
        <svg viewBox="0 0 20 20" fill="currentColor" className="size-4 opacity-40">
          <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
        </svg>
      ) : (
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
      )}
    </div>
  );
}
