-- Aplikasi mobile: laporan konten (Laporkan) dan Sign in with Apple.
-- Semuanya tambahan; tidak ada kolom lama yang diubah atau dibuang.

-- AlterTable
ALTER TABLE `users` ADD COLUMN `apple_id` VARCHAR(255) NULL;

-- CreateTable
CREATE TABLE `content_reports` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `jenis` VARCHAR(20) NOT NULL,
    `target_id` VARCHAR(100) NOT NULL,
    `alasan` VARCHAR(30) NOT NULL,
    `catatan` TEXT NULL,
    `reporter_user_id` BIGINT UNSIGNED NULL,
    `ip_address` VARCHAR(45) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'baru',
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `content_reports_jenis_target_id_index`(`jenis`, `target_id`),
    INDEX `content_reports_status_created_at_index`(`status`, `created_at`),
    INDEX `content_reports_reporter_user_id_foreign`(`reporter_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `users_apple_id_unique` ON `users`(`apple_id`);

-- AddForeignKey
ALTER TABLE `content_reports` ADD CONSTRAINT `content_reports_reporter_user_id_foreign` FOREIGN KEY (`reporter_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

