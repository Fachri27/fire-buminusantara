"use client";

/**
 * Isian form CMS — satu tempat kebenaran untuk bentuk bidang isian.
 *
 * Sebelumnya komponen-komponen ini privat di app/admin/kejadian/form.tsx.
 * Diangkat ke sini saat form perapian laporan butuh bentuk yang sama: dua
 * salinan label, teks bantuan, dan penanda wajib akan menyimpang sendiri
 * begitu salah satunya disentuh — dan yang terlihat pengguna adalah dua form
 * di CMS yang sama yang terasa dibuat orang berbeda.
 */

/** Penanda bidang wajib. aria-hidden: `required` pada input sudah
 *  menyampaikannya ke pembaca layar, bintang ini murni petunjuk visual. */
export function Wajib() {
  return <span aria-hidden="true" className="text-[var(--api)]"> *</span>;
}

export function Bantuan({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-[12px] leading-[1.5] text-[var(--lirih)]">{children}</p>;
}

export function Isian({
  label,
  nama,
  nilai,
  value,
  onChange,
  tipe = "text",
  wajib,
  bantuan,
  mono,
  panjangMaks,
  penunjuk,
  mati,
}: {
  label: string;
  nama: string;
  nilai?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  tipe?: string;
  wajib?: boolean;
  bantuan?: string;
  mono?: boolean;
  panjangMaks?: number;
  penunjuk?: string;
  mati?: boolean;
}) {
  return (
    <div>
      <label htmlFor={nama} className="cms-mata mb-1.5 block">
        {label}{wajib && <Wajib />}
      </label>
      <input
        id={nama}
        name={nama}
        type={tipe}
        {...(value !== undefined ? { value, onChange } : { defaultValue: nilai, onChange })}
        required={wajib}
        maxLength={panjangMaks}
        placeholder={penunjuk}
        disabled={mati}
        className={`cms-isian w-full ${mono ? "cms-angka" : ""}`}
      />
      {bantuan && <Bantuan>{bantuan}</Bantuan>}
    </div>
  );
}

export function IsianPanjang({
  label,
  nama,
  nilai,
  bantuan,
  baris = 4,
  wajib,
  panjangMaks,
  mati,
}: {
  label: string;
  nama: string;
  nilai: string;
  bantuan?: string;
  baris?: number;
  wajib?: boolean;
  panjangMaks?: number;
  mati?: boolean;
}) {
  return (
    <div>
      <label htmlFor={nama} className="cms-mata mb-1.5 block">
        {label}{wajib && <Wajib />}
      </label>
      <textarea
        id={nama}
        name={nama}
        rows={baris}
        defaultValue={nilai}
        required={wajib}
        maxLength={panjangMaks}
        disabled={mati}
        className="cms-isian w-full"
      />
      {bantuan && <Bantuan>{bantuan}</Bantuan>}
    </div>
  );
}

/**
 * Isian koordinat terkendali.
 *
 * Selalu terkendali karena koordinat punya lebih dari satu penulis: hasil
 * pencarian tempat, titik yang ditekan di peta, dan ketikan manual — ketiganya
 * menulis ke state yang sama, jadi nilainya tidak boleh dipegang DOM.
 *
 * `wajib` opsional: kejadian publik harus punya titik, laporan warga tidak —
 * sebagian pelapor memang mengirim tanpa lokasi.
 */
export function IsianKoordinat({ label, nama, nilai, onUbah, wajib, mati, bantuan }: {
  label: string;
  nama: string;
  nilai: string;
  onUbah: (v: string) => void;
  wajib?: boolean;
  mati?: boolean;
  bantuan?: string;
}) {
  return (
    <div>
      <label htmlFor={nama} className="cms-mata mb-1.5 block">
        {label}{wajib && <Wajib />}
      </label>
      <input id={nama} name={nama} type="number" step="any" required={wajib} disabled={mati}
             value={nilai} onChange={(e) => onUbah(e.target.value)}
             className="cms-isian cms-angka w-full" />
      {bantuan && <Bantuan>{bantuan}</Bantuan>}
    </div>
  );
}
