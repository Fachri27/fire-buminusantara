-- Bidang perapian kurator pada laporan warga.
--
-- Sebelumnya promosi laporan → kejadian mengarang tiga nilai sendiri:
-- title_en disalin dari judul Indonesia, description_en dibiarkan null, dan
-- nama lokasi di-reverse-geocode dari koordinat. Ketiganya kini bisa dirapikan
-- kurator SEBELUM verifikasi, dan yang tersimpan di sinilah yang naik.
--
-- Semuanya NULL: laporan yang masuk dari publik tidak pernah mengisinya, dan
-- baris lama tidak boleh mendadak tidak sah. Kosong = pakai perilaku lama.
ALTER TABLE `public_reports`
  ADD COLUMN `title_en`       VARCHAR(255) NULL AFTER `title`,
  ADD COLUMN `description_en` TEXT         NULL AFTER `description`,
  ADD COLUMN `location`       VARCHAR(255) NULL AFTER `description_en`;
