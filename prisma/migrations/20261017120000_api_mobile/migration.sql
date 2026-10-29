-- API mobile (aplikasi Lapor Karhutla): sesi akun warga, pemilik laporan dari
-- aplikasi, dan kejadian hasil promosi. Semuanya tambahan; tidak ada kolom
-- lama yang diubah atau dibuang.

-- AlterTable
ALTER TABLE `public_reports` ADD COLUMN `event_id` BIGINT UNSIGNED NULL,
    ADD COLUMN `reporter_user_id` BIGINT UNSIGNED NULL;

-- CreateTable
CREATE TABLE `mobile_sessions` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `token_hash` CHAR(64) NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `last_used_at` TIMESTAMP(0) NULL,

    UNIQUE INDEX `mobile_sessions_token_hash_unique`(`token_hash`),
    INDEX `mobile_sessions_user_id_foreign`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `public_reports_reporter_user_id_created_at_index` ON `public_reports`(`reporter_user_id`, `created_at`);

-- CreateIndex
CREATE INDEX `public_reports_event_id_foreign` ON `public_reports`(`event_id`);

-- AddForeignKey
ALTER TABLE `public_reports` ADD CONSTRAINT `public_reports_reporter_user_id_foreign` FOREIGN KEY (`reporter_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `public_reports` ADD CONSTRAINT `public_reports_event_id_foreign` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `mobile_sessions` ADD CONSTRAINT `mobile_sessions_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

