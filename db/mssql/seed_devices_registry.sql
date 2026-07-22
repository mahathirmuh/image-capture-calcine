SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRAN;

DECLARE @locations TABLE (
  plant NVARCHAR(100) NOT NULL,
  area NVARCHAR(100) NULL,
  bin NVARCHAR(100) NOT NULL,
  station NVARCHAR(100) NOT NULL
);

INSERT INTO @locations (plant, area, bin, station)
VALUES
  (N'Acid Plant', NULL, N'Bin 1 / Bin 2', N'Main Area'),
  (N'Acid Plant', NULL, N'Bin 1 / Bin 2', N'Secondary Area'),
  (N'Acid Plant', NULL, N'Bin 1 / Bin 2', N'Loading Bay'),
  (N'Acid Plant', NULL, N'Bin 1', N'Main Area'),
  (N'Acid Plant', NULL, N'Bin 1', N'Secondary Area'),
  (N'Acid Plant', NULL, N'Bin 1', N'Loading Bay'),
  (N'Acid Plant', NULL, N'Bin 2', N'Main Area'),
  (N'Acid Plant', NULL, N'Bin 2', N'Secondary Area'),
  (N'Acid Plant', NULL, N'Bin 2', N'Loading Bay'),
  (N'Chloride Plant', NULL, N'Bin 1 / Bin 2', N'Main Area'),
  (N'Chloride Plant', NULL, N'Bin 1 / Bin 2', N'Secondary Area'),
  (N'Chloride Plant', NULL, N'Bin 1 / Bin 2', N'Loading Bay'),
  (N'Chloride Plant', NULL, N'Bin 1', N'Main Area'),
  (N'Chloride Plant', NULL, N'Bin 1', N'Secondary Area'),
  (N'Chloride Plant', NULL, N'Bin 1', N'Loading Bay'),
  (N'Chloride Plant', NULL, N'Bin 2', N'Main Area'),
  (N'Chloride Plant', NULL, N'Bin 2', N'Secondary Area'),
  (N'Chloride Plant', NULL, N'Bin 2', N'Loading Bay');

INSERT INTO dbo.locations (plant, area, bin, station, notes)
SELECT
  src.plant,
  src.area,
  src.bin,
  src.station,
  N'Seed awal registry device'
FROM @locations src
WHERE NOT EXISTS (
  SELECT 1
  FROM dbo.locations dst
  WHERE dst.plant = src.plant
    AND ISNULL(dst.area, N'') = ISNULL(src.area, N'')
    AND ISNULL(dst.bin, N'') = ISNULL(src.bin, N'')
    AND ISNULL(dst.station, N'') = ISNULL(src.station, N'')
);

DECLARE @deviceId BIGINT;
DECLARE @locationId BIGINT;
DECLARE @profileId BIGINT;
DECLARE @configJson NVARCHAR(MAX) = N'{
  "templateId": "default-calcine-r50",
  "schedule": "Every 3 Hours",
  "timezone": "Asia/Makassar (WITA)",
  "cameraSettings": {
    "iso": "200",
    "shutter": "1/125",
    "aperture": "f/8",
    "whiteBalance": "Daylight",
    "pictureStyle": "Standard",
    "focusMode": "Autofocus"
  }
}';

SELECT TOP 1
  @locationId = id
FROM dbo.locations
WHERE plant = N'Acid Plant'
  AND ISNULL(area, N'') = N''
  AND bin = N'Bin 1 / Bin 2'
  AND station = N'Main Area';

IF @locationId IS NULL
BEGIN
  THROW 50001, 'Lokasi seed default tidak ditemukan.', 1;
END;

SELECT TOP 1
  @deviceId = id
FROM dbo.devices
WHERE code = N'edge-camera-01'
  AND is_deleted = 0;

IF @deviceId IS NULL
BEGIN
  INSERT INTO dbo.devices (
    code,
    name,
    connection_type,
    edge_api_url,
    notes,
    is_active,
    is_deleted
  )
  VALUES (
    N'edge-camera-01',
    N'EDGE-CAMERA-01',
    N'usb',
    N'http://10.60.20.196:3000',
    N'Seed awal dari edge API aktif. Ubah metadata detail dari halaman Devices/Register.',
    1,
    0
  );

  SET @deviceId = SCOPE_IDENTITY();
END
ELSE
BEGIN
  UPDATE dbo.devices
  SET
    name = N'EDGE-CAMERA-01',
    connection_type = N'usb',
    edge_api_url = N'http://10.60.20.196:3000',
    notes = N'Seed awal dari edge API aktif. Ubah metadata detail dari halaman Devices/Register.',
    is_active = 1,
    updated_at = SYSUTCDATETIME()
  WHERE id = @deviceId;
END;

IF EXISTS (
  SELECT 1
  FROM dbo.device_assignments
  WHERE device_id = @deviceId
    AND is_current = 1
    AND location_id <> @locationId
)
BEGIN
  UPDATE dbo.device_assignments
  SET
    is_current = 0,
    assigned_to = SYSUTCDATETIME()
  WHERE device_id = @deviceId
    AND is_current = 1
    AND location_id <> @locationId;
END;

IF NOT EXISTS (
  SELECT 1
  FROM dbo.device_assignments
  WHERE device_id = @deviceId
    AND location_id = @locationId
    AND is_current = 1
)
BEGIN
  INSERT INTO dbo.device_assignments (
    device_id,
    location_id,
    is_current
  )
  VALUES (
    @deviceId,
    @locationId,
    1
  );
END;

SELECT TOP 1
  @profileId = id
FROM dbo.device_config_profiles
WHERE device_id = @deviceId
  AND profile_name = N'default'
ORDER BY updated_at DESC, id DESC;

IF @profileId IS NULL
BEGIN
  INSERT INTO dbo.device_config_profiles (
    device_id,
    profile_name,
    profile_type,
    config_json,
    is_active
  )
  VALUES (
    @deviceId,
    N'default',
    N'device-default',
    @configJson,
    1
  );

  SET @profileId = SCOPE_IDENTITY();
END
ELSE
BEGIN
  UPDATE dbo.device_config_profiles
  SET
    profile_type = N'device-default',
    config_json = @configJson,
    is_active = 1,
    updated_at = SYSUTCDATETIME()
  WHERE id = @profileId;
END;

IF NOT EXISTS (
  SELECT 1
  FROM dbo.device_config_history
  WHERE device_id = @deviceId
    AND notes = N'Seed awal registry MSSQL'
)
BEGIN
  INSERT INTO dbo.device_config_history (
    device_id,
    profile_id,
    changed_by,
    change_source,
    before_json,
    after_json,
    notes
  )
  VALUES (
    @deviceId,
    @profileId,
    N'seed-script',
    N'mssql-seed',
    NULL,
    @configJson,
    N'Seed awal registry MSSQL'
  );
END;

COMMIT;

SELECT
  d.code,
  d.name,
  l.plant,
  l.bin,
  l.station,
  d.edge_api_url,
  p.profile_name
FROM dbo.devices d
LEFT JOIN dbo.device_assignments da
  ON da.device_id = d.id
  AND da.is_current = 1
LEFT JOIN dbo.locations l
  ON l.id = da.location_id
LEFT JOIN dbo.device_config_profiles p
  ON p.device_id = d.id
  AND p.is_active = 1
WHERE d.is_deleted = 0
ORDER BY d.name ASC;
