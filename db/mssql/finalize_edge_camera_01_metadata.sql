SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRAN;

DECLARE @deviceId BIGINT;
DECLARE @locationId BIGINT;

SELECT TOP 1
  @deviceId = id
FROM dbo.devices
WHERE code = N'edge-camera-01'
  AND is_deleted = 0;

IF @deviceId IS NULL
BEGIN
  THROW 50011, 'Device edge-camera-01 belum ada di registry.', 1;
END;

SELECT TOP 1
  @locationId = id
FROM dbo.locations
WHERE plant = N'Acid Plant'
  AND ISNULL(area, N'') = N''
  AND bin = N'Bin 1 / Bin 2'
  AND station = N'Main Area';

IF @locationId IS NULL
BEGIN
  THROW 50012, 'Lokasi default Acid Plant / Bin 1 / Bin 2 / Main Area tidak ditemukan.', 1;
END;

UPDATE dbo.devices
SET
  name = N'EDGE-CAMERA-01',
  serial_number = NULL,
  ip_address = NULL,
  connection_type = N'usb',
  camera_model = NULL,
  edge_api_url = N'http://10.60.20.196:3000',
  notes = N'Metadata final sementara berdasarkan data yang sudah diketahui. Serial number, IP address, dan model kamera masih belum tersedia karena edge API sedang disconnected.',
  is_active = 1,
  updated_at = SYSUTCDATETIME()
WHERE id = @deviceId;

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

IF NOT EXISTS (
  SELECT 1
  FROM dbo.device_events
  WHERE device_id = @deviceId
    AND event_type = N'metadata-finalized'
    AND message = N'Metadata device difinalisasi berdasarkan data yang sudah diketahui dari edge API.'
)
BEGIN
  INSERT INTO dbo.device_events (
    device_id,
    event_type,
    severity,
    message,
    payload_json
  )
  VALUES (
    @deviceId,
    N'metadata-finalized',
    N'info',
    N'Metadata device difinalisasi berdasarkan data yang sudah diketahui dari edge API.',
    N'{"source":"manual-finalize","unknownFields":["serial_number","ip_address","camera_model"]}'
  );
END;

COMMIT;

SELECT
  d.code,
  d.name,
  d.connection_type,
  d.camera_model,
  d.serial_number,
  d.ip_address,
  d.edge_api_url,
  d.notes,
  l.plant,
  l.bin,
  l.station
FROM dbo.devices d
LEFT JOIN dbo.device_assignments da
  ON da.device_id = d.id
  AND da.is_current = 1
LEFT JOIN dbo.locations l
  ON l.id = da.location_id
WHERE d.id = @deviceId;
