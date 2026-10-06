-- Menambahkan bahasa default pada akun aplikasi.
--
-- Jalankan sekali terhadap database Capture-Calcine. Idempoten.
--
-- Nilainya kode bahasa antarmuka dari src/lib/i18n.tsx: 'id' (Indonesia),
-- 'en' (English), atau 'zh' (中文). Bahasa ini dipasang setiap kali akunnya
-- masuk -- di web, dan di aplikasi mobile untuk 'en' dan 'zh' (mobile tidak
-- punya bahasa Indonesia, jadi 'id' di sana tidak mengubah apa pun).
--
-- Baris yang sudah ada diberi 'id', bahasa bawaan aplikasi sejak awal. Kolomnya
-- NOT NULL supaya tidak ada keadaan ketiga "belum pernah diisi" yang harus
-- ditafsirkan di setiap tempat nilainya dibaca.
--
-- Aplikasi tetap berjalan sebelum skrip ini dijalankan: tanpa kolomnya, pilihan
-- bahasa di halaman Users ditolak dengan pesan yang menunjuk ke skrip ini, dan
-- login tidak mengubah bahasa.

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.app_users') AND name = N'default_language'
)
BEGIN
  ALTER TABLE dbo.app_users
    ADD default_language NVARCHAR(10) NOT NULL
      CONSTRAINT DF_app_users_default_language DEFAULT (N'id');
END;

-- Dibungkus sp_executesql karena SQL Server mengompilasi seluruh batch sebelum
-- menjalankan baris pertamanya; lihat catatan di add_app_users_plant.sql.
EXEC sp_executesql N'SELECT default_language, COUNT(*) AS jumlah FROM dbo.app_users GROUP BY default_language;';
