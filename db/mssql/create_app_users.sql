-- Tabel akun operator untuk halaman login aplikasi.
--
-- Jalankan sekali terhadap database Capture-Calcine (nilai CARDDB_NAME di
-- .env). Skrip ini idempoten: aman dijalankan ulang di database yang tabelnya
-- sudah ada.
--
-- Akun TIDAK dibuat di sini. Password harus melewati hashing scrypt milik
-- aplikasi, jadi tambah/ubah akun lewat:
--
--   node --env-file=.env scripts/create-user.mjs <username> <password> --name "Nama Lengkap"
--
-- Menulis INSERT manual dengan password apa adanya akan menghasilkan baris
-- yang tidak pernah bisa login: verifikasi selalu gagal untuk nilai yang bukan
-- hash scrypt berformat `scrypt$N$r$p$salt$hash`.

SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRAN;

IF OBJECT_ID(N'dbo.app_users', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.app_users (
    id BIGINT IDENTITY(1, 1) NOT NULL,
    username NVARCHAR(100) NOT NULL,
    full_name NVARCHAR(200) NOT NULL,
    email NVARCHAR(200) NULL,
    -- scrypt$N$r$p$salt$hash -- 400 karakter memberi ruang lebih kalau
    -- parameter biaya dinaikkan nanti (hash saat ini ~140 karakter).
    password_hash NVARCHAR(400) NOT NULL,
    role NVARCHAR(50) NOT NULL CONSTRAINT DF_app_users_role DEFAULT (N'operator'),
    is_active BIT NOT NULL CONSTRAINT DF_app_users_is_active DEFAULT (1),
    last_login_at DATETIME2(3) NULL,
    created_at DATETIME2(3) NOT NULL CONSTRAINT DF_app_users_created_at DEFAULT (SYSUTCDATETIME()),
    updated_at DATETIME2(3) NOT NULL CONSTRAINT DF_app_users_updated_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_app_users PRIMARY KEY CLUSTERED (id)
  );
END;

-- Username adalah identitas login utama, jadi wajib unik.
IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = N'UX_app_users_username' AND object_id = OBJECT_ID(N'dbo.app_users')
)
BEGIN
  CREATE UNIQUE INDEX UX_app_users_username ON dbo.app_users (username);
END;

-- Email opsional. Indeks difilter supaya banyak baris ber-email NULL tetap
-- boleh hidup berdampingan, sementara email yang diisi tetap unik -- kolom ini
-- ikut dipakai sebagai identitas login.
IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = N'UX_app_users_email' AND object_id = OBJECT_ID(N'dbo.app_users')
)
BEGIN
  CREATE UNIQUE INDEX UX_app_users_email ON dbo.app_users (email) WHERE email IS NOT NULL;
END;

COMMIT;

SELECT
  COUNT(*) AS total_akun,
  SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS akun_aktif
FROM dbo.app_users;
