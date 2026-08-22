-- Menambahkan kolom penempatan plant pada akun aplikasi.
--
-- Jalankan sekali terhadap database Capture-Calcine. Idempoten.
--
-- Nilainya salah satu nama plant dari src/lib/locations.ts -- 'Acid Plant',
-- 'Chloride Plant', 'Pyrite Plant', 'Copper Cathode Plant' -- atau sentinel
-- 'ALL' untuk operator yang tidak terikat satu plant.
--
-- 'ALL' sengaja disimpan sebagai nilai, bukan NULL. NULL di kolom ini akan
-- berarti dua hal sekaligus: "berlaku di semua plant" dan "belum pernah diisi",
-- dan keduanya menuntut tindakan yang berbeda saat nanti kolom ini dipakai
-- membatasi akses.
--
-- Baris yang sudah ada diberi 'ALL': mengubah akun yang tadinya bisa apa saja
-- menjadi terikat satu plant adalah keputusan orang, bukan efek samping migrasi.

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.app_users') AND name = N'plant'
)
BEGIN
  ALTER TABLE dbo.app_users
    ADD plant NVARCHAR(100) NOT NULL CONSTRAINT DF_app_users_plant DEFAULT (N'ALL');
END;

-- Dibungkus sp_executesql, bukan ditulis langsung. SQL Server mengompilasi
-- seluruh batch sebelum menjalankan baris pertamanya, jadi SELECT yang menyebut
-- kolom hasil ALTER di atas akan gagal parse padahal kolomnya akan ada saat
-- gilirannya tiba. Dinamis berarti kompilasinya ditunda sampai dieksekusi.
EXEC sp_executesql N'SELECT plant, COUNT(*) AS jumlah FROM dbo.app_users GROUP BY plant;';
