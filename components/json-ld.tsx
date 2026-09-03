// Pembungkus <script type="application/ld+json"> untuk data terstruktur.
// Dipisah supaya halaman cukup mengoper objek — pola script native (bukan
// next/script) mengikuti panduan JSON-LD Next karena ini data, bukan kode.
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      // Ganti "<" mentah sesuai panduan Next agar string judul/deskripsi dari
      // database tidak bisa menyuntik tag lewat payload JSON ini.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
