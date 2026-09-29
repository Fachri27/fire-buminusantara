-- Sorotan jadi kartu strip statistik per bahasa (angka + keterangan).
-- Enam kolom angka lama tak pernah tampil di situs, jadi dibuang.
ALTER TABLE sorotan_statistik
  ADD COLUMN kartu JSON NULL AFTER id,
  DROP COLUMN hotspot,
  DROP COLUMN api_aktif,
  DROP COLUMN lahan_terbakar,
  DROP COLUMN korban_ispa,
  DROP COLUMN rugi_ekonomi,
  DROP COLUMN korban_satwa;
