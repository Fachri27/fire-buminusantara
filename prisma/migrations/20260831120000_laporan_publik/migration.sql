-- CreateTable
CREATE TABLE `public_reports` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NOT NULL,
    `media` JSON NULL,
    `reporter_name` VARCHAR(255) NULL,
    `location_lat` DECIMAL(10, 7) NULL,
    `location_lng` DECIMAL(10, 7) NULL,
    `status` ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    `ip_address` VARCHAR(45) NULL,
    `reviewed_by` BIGINT UNSIGNED NULL,
    `reviewed_at` TIMESTAMP(0) NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    INDEX `public_reports_status_created_at_index`(`status`, `created_at`),
    INDEX `public_reports_reviewed_by_foreign`(`reviewed_by`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `public_reports` ADD CONSTRAINT `public_reports_reviewed_by_foreign` FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;
