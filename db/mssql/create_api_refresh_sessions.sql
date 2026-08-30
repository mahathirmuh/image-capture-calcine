-- Sesi refresh token untuk klien mobile / REST.
--
-- Jalankan sekali terhadap database Capture-Calcine. Idempoten.
--
-- Access token REST sengaja pendek (12 jam) supaya token bearer yang bocor
-- tidak hidup terlalu lama. Klien mobile butuh sesi yang lebih awet dari itu,
-- jadi yang dipertahankan adalah refresh token acak yang DIROTASI setiap kali
-- dipakai. Yang disimpan di database hanya hash-nya, bukan token mentahnya.

SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRAN;

IF OBJECT_ID(N'dbo.app_api_refresh_sessions', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.app_api_refresh_sessions (
    id BIGINT IDENTITY(1, 1) NOT NULL,
    user_id BIGINT NOT NULL,
    token_hash NVARCHAR(128) NOT NULL,
    expires_at DATETIME2(3) NOT NULL,
    last_used_at DATETIME2(3) NULL,
    revoked_at DATETIME2(3) NULL,
    created_at DATETIME2(3) NOT NULL CONSTRAINT DF_app_api_refresh_sessions_created_at DEFAULT (SYSUTCDATETIME()),
    updated_at DATETIME2(3) NOT NULL CONSTRAINT DF_app_api_refresh_sessions_updated_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_app_api_refresh_sessions PRIMARY KEY CLUSTERED (id),
    CONSTRAINT FK_app_api_refresh_sessions_user
      FOREIGN KEY (user_id) REFERENCES dbo.app_users(id)
  );
END;

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = N'UX_app_api_refresh_sessions_token_hash'
    AND object_id = OBJECT_ID(N'dbo.app_api_refresh_sessions')
)
BEGIN
  CREATE UNIQUE INDEX UX_app_api_refresh_sessions_token_hash
    ON dbo.app_api_refresh_sessions (token_hash);
END;

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = N'IX_app_api_refresh_sessions_user_active'
    AND object_id = OBJECT_ID(N'dbo.app_api_refresh_sessions')
)
BEGIN
  CREATE INDEX IX_app_api_refresh_sessions_user_active
    ON dbo.app_api_refresh_sessions (user_id, revoked_at, expires_at);
END;

COMMIT;

SELECT
  COUNT(*) AS total_sessions,
  SUM(CASE WHEN revoked_at IS NULL AND expires_at > SYSUTCDATETIME() THEN 1 ELSE 0 END) AS session_aktif
FROM dbo.app_api_refresh_sessions;
