-- Peran bawaan users menjadi commenter: tabel ini dipakai bersama aplikasi
-- Laravel, yang bisa menyisipkan akun (mis. masuk Google) tanpa menyebut
-- peran — dengan bawaan lama akun itu otomatis menjadi editor CMS.
-- Hanya bawaan kolom yang berubah; baris yang sudah ada tidak disentuh.

-- AlterTable
ALTER TABLE `users` MODIFY `role` ENUM('admin', 'editor', 'commenter') NOT NULL DEFAULT 'commenter';
