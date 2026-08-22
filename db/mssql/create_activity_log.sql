-- Jejak aktivitas akun: siapa masuk, siapa gagal masuk, dan siapa mengubah apa
-- di halaman Users.
--
-- Jalankan sekali terhadap database Capture-Calcine (nilai CARDDB_NAME di
-- .env). Skrip ini idempoten: aman dijalankan ulang.
--
-- Nama pelaku dan sasaran sengaja DISALIN ke dalam baris log, bukan cuma
-- disimpan sebagai foreign key ke app_users. Jejak audit harus tetap terbaca
-- setelah akunnya dihapus -- justru penghapusan akun itulah salah satu hal yang
-- paling perlu bisa ditelusuri, dan foreign key dengan cascade akan menghapus
-- buktinya bersama akunnya.

SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRAN;

IF OBJECT_ID(N'dbo.activity_log', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.activity_log (
    id BIGINT IDENTITY(1, 1) NOT NULL,
    occurred_at DATETIME2(3) NOT NULL
      CONSTRAINT DF_activity_log_occurred_at DEFAULT (SYSUTCDATETIME()),
    -- login.success | login.failed | login.blocked | logout
    -- user.created | user.updated | user.deleted | user.password_reset
    action NVARCHAR(50) NOT NULL,
    -- info | warning -- dipakai untuk mewarnai baris, bukan untuk menyaring hak
    severity NVARCHAR(20) NOT NULL CONSTRAINT DF_activity_log_severity DEFAULT (N'info'),
    actor_id BIGINT NULL,
    actor_username NVARCHAR(100) NULL,
    target_id BIGINT NULL,
    target_username NVARCHAR(100) NULL,
    detail NVARCHAR(500) NULL,
    ip_address NVARCHAR(64) NULL,
    CONSTRAINT PK_activity_log PRIMARY KEY CLUSTERED (id)
  );
END;

-- Halaman Log selalu membaca yang terbaru lebih dulu, jadi indeksnya menurun.
IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'IX_activity_log_occurred_at' AND object_id = OBJECT_ID(N'dbo.activity_log')
)
BEGIN
  CREATE INDEX IX_activity_log_occurred_at ON dbo.activity_log (occurred_at DESC);
END;

-- Menyaring per jenis aksi (misalnya hanya login gagal) dan menelusuri satu
-- akun adalah dua penelusuran yang paling sering dipakai saat ada insiden.
IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'IX_activity_log_action' AND object_id = OBJECT_ID(N'dbo.activity_log')
)
BEGIN
  CREATE INDEX IX_activity_log_action ON dbo.activity_log (action, occurred_at DESC);
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'IX_activity_log_actor' AND object_id = OBJECT_ID(N'dbo.activity_log')
)
BEGIN
  CREATE INDEX IX_activity_log_actor ON dbo.activity_log (actor_username, occurred_at DESC);
END;

COMMIT;

SELECT COUNT(*) AS total_baris FROM dbo.activity_log;
