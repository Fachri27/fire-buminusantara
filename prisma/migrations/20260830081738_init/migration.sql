-- CreateTable
CREATE TABLE `users` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `google_id` VARCHAR(255) NULL,
    `role` ENUM('admin', 'editor', 'commenter') NOT NULL DEFAULT 'editor',
    `email_verified_at` TIMESTAMP(0) NULL,
    `password` VARCHAR(255) NULL,
    `image` VARCHAR(255) NULL,
    `remember_token` VARCHAR(100) NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    UNIQUE INDEX `users_email_unique`(`email`),
    UNIQUE INDEX `users_google_id_unique`(`google_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `events` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `image_id` VARCHAR(300) NULL,
    `image_en` VARCHAR(300) NULL,
    `video` VARCHAR(300) NULL,
    `media` JSON NULL,
    `title_id` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(255) NULL,
    `title_en` VARCHAR(255) NOT NULL,
    `description_id` TEXT NULL,
    `description_en` TEXT NULL,
    `event_date` DATE NOT NULL,
    `location` VARCHAR(255) NOT NULL,
    `location_lat` DECIMAL(10, 7) NOT NULL,
    `location_lng` DECIMAL(10, 7) NOT NULL,
    `location_geojson` JSON NULL,
    `orientation` ENUM('landscape', 'horizontal') NOT NULL DEFAULT 'landscape',
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    UNIQUE INDEX `events_slug_unique`(`slug`),
    INDEX `events_event_date_index`(`event_date`),
    INDEX `events_orientation_index`(`orientation`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `comments` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `page_id` BIGINT UNSIGNED NULL,
    `commentable_type` VARCHAR(190) NULL,
    `commentable_id` BIGINT UNSIGNED NULL,
    `user_id` BIGINT UNSIGNED NULL,
    `name` VARCHAR(255) NULL,
    `email` VARCHAR(255) NULL,
    `body` TEXT NOT NULL,
    `ip_address` VARCHAR(45) NULL,
    `is_approved` BOOLEAN NOT NULL DEFAULT true,
    `parent_id` BIGINT UNSIGNED NULL,
    `mention_name` VARCHAR(255) NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    INDEX `comments_commentable_index`(`commentable_type`, `commentable_id`, `is_approved`),
    INDEX `comments_is_approved_created_at_index`(`is_approved`, `created_at`),
    INDEX `comments_parent_id_foreign`(`parent_id`),
    INDEX `comments_user_id_foreign`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `comment_reactions` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `comment_id` BIGINT UNSIGNED NOT NULL,
    `user_id` BIGINT UNSIGNED NULL,
    `ip_address` VARCHAR(45) NULL,
    `type` ENUM('like', 'dislike') NOT NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    INDEX `comment_reactions_comment_id_ip_address_index`(`comment_id`, `ip_address`),
    INDEX `comment_reactions_user_id_foreign`(`user_id`),
    UNIQUE INDEX `comment_reactions_comment_id_user_id_unique`(`comment_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `comments` ADD CONSTRAINT `comments_parent_id_foreign` FOREIGN KEY (`parent_id`) REFERENCES `comments`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `comments` ADD CONSTRAINT `comments_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `comment_reactions` ADD CONSTRAINT `comment_reactions_comment_id_foreign` FOREIGN KEY (`comment_id`) REFERENCES `comments`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `comment_reactions` ADD CONSTRAINT `comment_reactions_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;
