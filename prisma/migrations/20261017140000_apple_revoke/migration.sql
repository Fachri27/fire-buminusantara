-- Sign in with Apple: refresh_token disimpan supaya bisa dicabut lewat
-- https://appleid.apple.com/auth/revoke saat akun dihapus (App Store 5.1.1(v)).
-- Semuanya tambahan; tidak ada kolom lama yang diubah atau dibuang.

-- AlterTable
ALTER TABLE `users` ADD COLUMN `apple_client_id` VARCHAR(255) NULL,
    ADD COLUMN `apple_refresh_token` TEXT NULL;
