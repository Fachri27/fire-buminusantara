import type { Bahasa } from "@/lib/bahasa";

/**
 * Isi kebijakan privasi Lapor Karhutla (situs + aplikasi Laporin).
 *
 * Setiap butir di sini harus cocok dengan perilaku kode — ubah teksnya bila
 * perilakunya berubah (data baru dikumpulkan, layanan luar baru, dsb.), lalu
 * majukan DIPERBARUI. URL halaman ini dipakai consent screen Google, App Store,
 * dan Play Store.
 */

// ISI SEBELUM RILIS: lembaga yang mengelola situs & surel untuk permintaan data.
export const PENGELOLA = "[nama lembaga pengelola]";
export const SUREL_PRIVASI = "[surel kontak privasi]";

export const DIPERBARUI = new Date("2026-10-26T00:00:00+07:00");

/** `{surel}` di dalam teks dirender sebagai tautan mailto ke SUREL_PRIVASI. */
export type Bagian = { judul: string; paragraf?: string[]; butir?: string[] };

export const TEKS_PRIVASI: Record<Bahasa, { judul: string; diperbarui: string; pembuka: string; bagian: Bagian[] }> = {
  id: {
    judul: "Kebijakan Privasi",
    diperbarui: "Terakhir diperbarui",
    pembuka:
      "Kebijakan ini menjelaskan data apa yang dikumpulkan Lapor Karhutla — situs fire.nusantara.earth dan aplikasi Laporin — untuk apa data itu dipakai, siapa yang bisa melihatnya, dan bagaimana kamu mengatur atau menghapusnya.",
    bagian: [
      {
        judul: "Pengelola",
        paragraf: [`Lapor Karhutla dikelola oleh ${PENGELOLA}. Pertanyaan dan permintaan soal data pribadi bisa dikirim ke {surel}.`],
      },
      {
        judul: "Data yang kami kumpulkan",
        butir: [
          "Laporan kejadian: judul, deskripsi, foto atau video, titik lokasi (bila kamu mengisinya, menekan “Pakai lokasi saya”, atau titik itu terbaca dari GPS foto), dan nama — boleh dikosongkan dengan memilih anonim. Berkas disimpan apa adanya, termasuk metadata di dalamnya seperti lokasi GPS dan waktu pemotretan.",
          "Komentar: nama, alamat email, dan isi komentar. Bila kamu memilih anonim, nama tampil sebagai “Anonim” dan email tidak disimpan. Di aplikasi, nama dan email diambil dari akunmu.",
          "Suka: alamat IP dan jenis peramban (user agent), untuk mencegah satu perangkat memberi suka berulang kali.",
          "Akun aplikasi: saat kamu masuk dengan Google atau Apple, kami menerima nama, alamat email, foto profil (Google), dan ID akun dari penyedia itu. Untuk akun Apple kami juga menyimpan token yang hanya dipakai untuk mencabut akses aplikasi saat akunmu dihapus; token itu disimpan terenkripsi.",
          "Siaran langsung (aplikasi): judul, nama, dan titik lokasi bila kamu membagikannya. Gambar dan suara disalurkan langsung ke penonton dan tidak kami rekam.",
          "Laporan konten (“Laporkan” di aplikasi): alasan, catatan yang kamu tulis, dan akun atau alamat IP pengirimnya.",
          "Data teknis: alamat IP pengirim laporan, komentar, dan laporan konten dicatat untuk mencegah penyalahgunaan. Google Analytics mencatat statistik kunjungan situs dengan cookie.",
        ],
      },
      {
        judul: "Untuk apa data itu dipakai",
        butir: [
          "Memverifikasi laporan: kurator memeriksa setiap laporan sebelum tayang, dan dapat merapikan judul, deskripsi, serta nama tempatnya.",
          "Menayangkan kejadian karhutla di peta dan umpan, serta menghitung jumlah laporan per provinsi.",
          "Menjalankan akun, komentar, suka, dan siaran langsung.",
          "Mencegah spam dan penyalahgunaan: pemeriksaan captcha, pembatasan jumlah kiriman, dan moderasi konten yang dilaporkan.",
          "Memahami pemakaian situs secara keseluruhan lewat statistik kunjungan.",
          "Kami tidak menjual data pribadi dan tidak memakainya untuk iklan.",
        ],
      },
      {
        judul: "Apa yang tampil untuk publik",
        butir: [
          "Laporan yang lolos verifikasi tayang sebagai kejadian: judul, deskripsi, foto atau video, titik lokasi, tanggal, dan namamu sebagai keterangan foto — kecuali kamu memilih anonim. Laporan yang belum atau tidak lolos verifikasi tidak ditampilkan.",
          "Foto dan video yang tayang bisa dibuka dan diunduh siapa pun beserta metadata di dalamnya, termasuk lokasi GPS. Bila tidak ingin metadata itu ikut tersebar, matikan penandaan lokasi di kamera sebelum memotret.",
          "Komentar tampil bersama nama penulisnya. Email tidak pernah ditampilkan.",
          "Siaran publik tampil untuk semua warga dengan nama penyiar dan titik lokasi yang dibulatkan (sekitar 1 km). Siaran khusus petugas hanya bisa dilihat petugas, beserta titik lokasi persisnya.",
        ],
      },
      {
        judul: "Layanan pihak ketiga",
        paragraf: ["Sebagian fungsi memakai layanan luar, yang memproses data sesuai kebijakan privasinya masing-masing:"],
        butir: [
          "Cloudflare Turnstile — memeriksa bahwa pengirim laporan dan komentar bukan bot.",
          "Google Analytics — statistik kunjungan situs.",
          "Google Sign-In dan Sign in with Apple — masuk ke aplikasi.",
          "LiveKit — server penyalur siaran langsung.",
          "ipwho.is dan BigDataCloud — memperkirakan kota dari alamat IP untuk panel cuaca; BMKG dan Open-Meteo — data cuaca untuk lokasi itu.",
          "OpenStreetMap (Nominatim) — mencari nama tempat yang kamu ketik dan menerjemahkan titik lokasi laporan menjadi nama tempat.",
          "EOX dan OpenStreetMap untuk peta dasar, serta Windy untuk prakiraan cuaca di peta.",
        ],
      },
      {
        judul: "Penyimpanan dan keamanan",
        butir: [
          `Data disimpan di server yang dikelola ${PENGELOLA}.`,
          "Token sesi aplikasi hanya disimpan dalam bentuk hash, dan sesi yang tidak dipakai selama 90 hari berakhir dengan sendirinya.",
          "Laporan dan kejadian disimpan sebagai arsip kejadian karhutla selama dibutuhkan untuk tujuan di atas.",
        ],
      },
      {
        judul: "Menghapus akun dan hak atas datamu",
        paragraf: [
          "Kamu bisa menghapus akun aplikasi kapan saja dari dalam aplikasi. Akun, sesi, dan suka dihapus, dan akses aplikasi di akun Apple dicabut. Komentarmu tetap ada demi utas percakapan, tetapi namanya diganti “Akun dihapus” dan emailnya dibuang. Laporan yang sudah kamu kirim tetap tersimpan sebagai bukti kejadian, tanpa nama pelapor.",
          "Sesuai Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi, kamu berhak meminta akses, perbaikan, atau penghapusan data pribadimu, dan menarik persetujuan. Kirim permintaan ke {surel}. Untuk laporan atau komentar yang dikirim tanpa akun, sertakan judul dan tanggalnya supaya kami bisa menemukannya.",
        ],
      },
      {
        judul: "Perubahan kebijakan",
        paragraf: ["Bila kebijakan ini berubah, versi terbarunya dimuat di halaman ini dengan tanggal pembaruan di atas."],
      },
    ],
  },
  en: {
    judul: "Privacy Policy",
    diperbarui: "Last updated",
    pembuka:
      "This policy explains what data Lapor Karhutla — the fire.nusantara.earth website and the Laporin app — collects, what it is used for, who can see it, and how you can manage or delete it.",
    bagian: [
      {
        judul: "Who runs this service",
        paragraf: [`Lapor Karhutla is run by ${PENGELOLA}. Questions and requests about personal data can be sent to {surel}.`],
      },
      {
        judul: "Data we collect",
        butir: [
          "Fire reports: title, description, photos or videos, location (when you enter it, tap “Use my location”, or it is read from the photo’s GPS), and your name — which you can leave out by submitting anonymously. Files are stored as uploaded, including the metadata inside them such as GPS location and capture time.",
          "Comments: name, email address, and the comment. If you comment anonymously, your name shows as “Anonim” (anonymous) and your email is not stored. In the app, name and email come from your account.",
          "Likes: IP address and browser type (user agent), to stop one device from liking repeatedly.",
          "App accounts: when you sign in with Google or Apple, we receive your name, email address, profile photo (Google), and account ID from that provider. For Apple accounts we also keep a token used only to revoke the app’s access when you delete your account; it is stored encrypted.",
          "Live streams (app): title, name, and location if you share it. Video and audio are relayed directly to viewers and are not recorded by us.",
          "Content reports (“Report” in the app): the reason, any note you write, and the reporting account or IP address.",
          "Technical data: the IP address of whoever sends a report, comment, or content report is logged to prevent abuse. Google Analytics records site visit statistics using cookies.",
        ],
      },
      {
        judul: "How we use it",
        butir: [
          "To verify reports: curators review every report before it is published, and may tidy its title, description, and place name.",
          "To show fire incidents on the map and feed, and to count reports per province.",
          "To run accounts, comments, likes, and live streams.",
          "To prevent spam and abuse: captcha checks, submission limits, and moderation of reported content.",
          "To understand overall site usage through visit statistics.",
          "We do not sell personal data or use it for advertising.",
        ],
      },
      {
        judul: "What is public",
        butir: [
          "Reports that pass verification are published as incidents: title, description, photos or videos, location, date, and your name as the photo caption — unless you submitted anonymously. Reports that are pending or rejected are not shown.",
          "Published photos and videos can be opened and downloaded by anyone together with the metadata inside them, including GPS location. If you do not want that metadata shared, turn off location tagging in your camera before taking the photo.",
          "Comments are shown with the author’s name. Email addresses are never shown.",
          "Public live streams are visible to everyone with the streamer’s name and a location rounded to about 1 km. Officer-only streams can be seen by officers only, with their exact location.",
        ],
      },
      {
        judul: "Third-party services",
        paragraf: ["Some features rely on outside services, which process data under their own privacy policies:"],
        butir: [
          "Cloudflare Turnstile — checks that report and comment senders are not bots.",
          "Google Analytics — site visit statistics.",
          "Google Sign-In and Sign in with Apple — signing in to the app.",
          "LiveKit — the server that relays live streams.",
          "ipwho.is and BigDataCloud — estimate your city from your IP address for the weather panel; BMKG and Open-Meteo — weather data for that location.",
          "OpenStreetMap (Nominatim) — searches place names you type and turns report locations into place names.",
          "EOX and OpenStreetMap for base maps, and Windy for the weather forecast on the map.",
        ],
      },
      {
        judul: "Storage and security",
        butir: [
          `Data is stored on servers managed by ${PENGELOLA}.`,
          "App session tokens are stored only as hashes, and sessions unused for 90 days expire automatically.",
          "Reports and incidents are kept as an archive of fire events for as long as they serve the purposes above.",
        ],
      },
      {
        judul: "Deleting your account and your rights",
        paragraf: [
          "You can delete your app account at any time from within the app. Your account, sessions, and likes are deleted, and the app’s access to your Apple account is revoked. Your comments stay so conversations remain readable, but their name is replaced with “Akun dihapus” (account deleted) and their email is removed. Reports you already sent stay on record as evidence of the incident, without your name.",
          "Under Indonesia’s Personal Data Protection Law (Law No. 27 of 2022) you have the right to access, correct, or delete your personal data, and to withdraw consent. Send requests to {surel}. For reports or comments sent without an account, include their title and date so we can find them.",
        ],
      },
      {
        judul: "Changes to this policy",
        paragraf: ["If this policy changes, the latest version will be posted on this page with the update date above."],
      },
    ],
  },
};
