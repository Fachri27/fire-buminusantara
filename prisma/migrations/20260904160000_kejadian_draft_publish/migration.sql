-- Draft/publish untuk kejadian.
--
-- Default 'published' DISENGAJA: kolom ini ditambahkan ke tabel yang sudah
-- berisi kejadian tayang, dan tanpa default itu seluruh isi situs publik
-- menghilang begitu migrasi jalan. Basis data ini juga dipakai CMS Laravel,
-- yang menulis events tanpa tahu kolom ini — default membuat tulisannya tetap
-- sah dan hasilnya tetap tayang, sama seperti sebelumnya.
ALTER TABLE `events`
  ADD COLUMN `status` ENUM('draft', 'published') NOT NULL DEFAULT 'published';

CREATE INDEX `events_status_index` ON `events`(`status`);
