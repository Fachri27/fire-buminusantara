-- Keadaan tayang yang dituju laporan saat naik jadi kejadian.
--
-- BUKAN public_reports.status (pending/approved/rejected) — itu keputusan
-- terhadap laporannya. Kolom ini keputusan terhadap KEJADIAN yang lahir
-- darinya: langsung tayang, atau mendarat sebagai draft untuk dirapikan lagi
-- di form kejadian.
--
-- Default 'published' mempertahankan perilaku yang sudah berjalan: verifikasi
-- selama ini berarti tayang.
ALTER TABLE `public_reports`
  ADD COLUMN `event_status` ENUM('draft', 'published') NOT NULL DEFAULT 'published' AFTER `status`;
