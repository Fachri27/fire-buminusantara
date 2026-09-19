-- Enam angka kartu statistik landing karhutla (satu baris hidup).
CREATE TABLE sorotan_statistik (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  hotspot DECIMAL(15, 2) NOT NULL DEFAULT 5000.00,
  api_aktif DECIMAL(15, 2) NOT NULL DEFAULT 5000.00,
  lahan_terbakar DECIMAL(15, 2) NOT NULL DEFAULT 5000.00,
  korban_ispa DECIMAL(15, 2) NOT NULL DEFAULT 5000.00,
  rugi_ekonomi DECIMAL(15, 2) NOT NULL DEFAULT 5000.00,
  korban_satwa DECIMAL(15, 2) NOT NULL DEFAULT 5000.00,
  updated_at TIMESTAMP(0) NULL
) ENGINE = InnoDB, CHARACTER SET = utf8mb4, COLLATE = utf8mb4_unicode_ci;
