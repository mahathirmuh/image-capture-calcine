import sql from "mssql";

import { getCardDbPool, getCardDbSchema, isCardDbConfigured } from "../carddb";
import type { CaptureOperator, RecordCaptureInput } from "../capture-records";

function normalizeCaptureBinLabel(value: string): string | null {
  const normalized = value.trim().toUpperCase();
  if (normalized === "BIN 1" || normalized === "BIN1") return "Bin 1";
  if (normalized === "BIN 2" || normalized === "BIN2") return "Bin 2";
  if (normalized === "TRAIN 1" || normalized === "TRAIN1") return "Bin 1";
  if (normalized === "TRAIN 2" || normalized === "TRAIN2") return "Bin 2";
  if (normalized === "BIN 1 / BIN 2" || normalized === "BIN1/BIN2") return "Bin 1 / Bin 2";
  return null;
}

function toCaptureRecordStatus(saveMethod: RecordCaptureInput["saveMethod"]) {
  if (saveMethod === "browser-download") return "downloaded";
  if (saveMethod === "spooled") return "pending";
  return "saved";
}

function isLocalOnlySave(saveMethod: RecordCaptureInput["saveMethod"] | null | undefined): boolean {
  return saveMethod === "browser-download" || saveMethod === "browser-folder";
}

function buildCaptureRecordMetadata(input: RecordCaptureInput, operator: CaptureOperator = null) {
  return {
    source: "capture-page",
    deviceCode: input.deviceCode,
    deviceName: input.deviceName ?? null,
    plant: input.plant,
    captureBin: input.captureBin,
    captureSession: input.captureSession ?? null,
    capturedByUserId: operator?.id ?? null,
    capturedBy: operator?.name ?? null,
    station: input.station ?? null,
    saveMethod: input.saveMethod,
    assetId: input.assetId ?? null,
  };
}

async function resolveDeviceId(
  request: sql.Request,
  schema: string,
  deviceCode: string,
): Promise<number | null> {
  const result = await request.input("deviceCode", sql.NVarChar(50), deviceCode).query(`
      SELECT TOP 1 id
      FROM ${schema}.devices
      WHERE code = @deviceCode
        AND is_deleted = 0;
    `);

  return result.recordset[0] ? Number(result.recordset[0].id) : null;
}

async function resolveLocationId(
  request: sql.Request,
  schema: string,
  input: RecordCaptureInput,
  deviceId: number,
): Promise<number | null> {
  const preferredBin = normalizeCaptureBinLabel(input.captureBin);
  const result = await request
    .input("deviceId", sql.BigInt, deviceId)
    .input("plant", sql.NVarChar(100), input.plant)
    .input("preferredBin", sql.NVarChar(100), preferredBin)
    .input("station", sql.NVarChar(100), input.station ?? null).query(`
      SELECT TOP 1 l.id
      FROM ${schema}.locations l
      LEFT JOIN ${schema}.device_assignments da
        ON da.location_id = l.id
        AND da.device_id = @deviceId
        AND da.is_current = 1
      WHERE l.plant = @plant
        AND (
          @preferredBin IS NULL
          OR l.bin = @preferredBin
          OR l.bin = N'Bin 1 / Bin 2'
        )
      ORDER BY
        CASE WHEN da.id IS NOT NULL THEN 0 ELSE 1 END,
        CASE
          WHEN @preferredBin IS NOT NULL AND l.bin = @preferredBin THEN 0
          WHEN l.bin = N'Bin 1 / Bin 2' THEN 1
          ELSE 2
        END,
        CASE
          WHEN @station IS NOT NULL AND l.station = @station THEN 0
          ELSE 1
        END,
        l.id;
    `);

  return result.recordset[0] ? Number(result.recordset[0].id) : null;
}

async function logCaptureCreated(
  data: RecordCaptureInput,
  operator: CaptureOperator,
  recordId: number,
  replaced: boolean,
): Promise<void> {
  const { recordActivity } = await import("./activity");
  const keNetwork = data.saveMethod === "app-network";
  const bagian = [
    `${data.plant} / ${data.captureBin}`,
    data.captureSession ? `sesi ${data.captureSession}` : null,
    `metode ${data.saveMethod}`,
    replaced ? "menimpa capture sebelumnya di sesi yang sama" : null,
  ].filter(Boolean);

  await recordActivity({
    action: "capture.created",
    severity: keNetwork || data.saveMethod === "spooled" ? "info" : "warning",
    actorId: operator?.id ?? null,
    actorUsername: operator?.name ?? null,
    targetId: recordId,
    targetUsername: data.fileName,
    detail: bagian.join(" - "),
  });
}

export async function upsertCaptureRecordResult(
  data: RecordCaptureInput,
  operator: CaptureOperator = null,
): Promise<
  | { ok: true; recordId: number; locationId: number | null; replaced: boolean }
  | { ok: false; code: string; message: string }
> {
  if (!isCardDbConfigured()) {
    return {
      ok: false,
      code: "CARDDB_NOT_CONFIGURED",
      message: "Konfigurasi CARDDB belum lengkap di server aplikasi.",
    };
  }

  try {
    const schema = `[${getCardDbSchema()}]`;
    const pool = await getCardDbPool();
    const request = pool.request();
    const deviceId = await resolveDeviceId(request, schema, data.deviceCode);

    if (!deviceId) {
      return {
        ok: false,
        code: "DEVICE_NOT_FOUND",
        message: `Device ${data.deviceCode} belum terdaftar di registry MSSQL.`,
      };
    }

    const locationId = await resolveLocationId(pool.request(), schema, data, deviceId);
    const metadataJson = JSON.stringify(buildCaptureRecordMetadata(data, operator));

    const replacesExisting = !isLocalOnlySave(data.saveMethod);
    let recordId: number | null = null;

    if (replacesExisting) {
      const existing = await pool.request().input("filePath", sql.NVarChar(500), data.filePath)
        .query(`
          SELECT TOP 1 id FROM ${schema}.capture_records
          WHERE file_path = @filePath
          ORDER BY id DESC;
        `);
      const found = existing.recordset[0]?.id;
      if (found != null) recordId = Number(found);
    }

    const write = pool
      .request()
      .input("deviceId", sql.BigInt, deviceId)
      .input("locationId", sql.BigInt, locationId)
      .input("capturedAt", sql.DateTime2, new Date(data.capturedAt))
      .input("fileName", sql.NVarChar(255), data.fileName)
      .input("filePath", sql.NVarChar(500), data.filePath)
      .input("status", sql.NVarChar(30), toCaptureRecordStatus(data.saveMethod))
      .input("fileSizeBytes", sql.BigInt, data.fileSizeBytes)
      .input("checksumSha256", sql.NVarChar(64), data.checksumSha256 ?? null)
      .input("metadataJson", sql.NVarChar(sql.MAX), metadataJson);

    if (recordId !== null) {
      await write.input("recordId", sql.BigInt, recordId).query(`
        UPDATE ${schema}.capture_records
        SET
          device_id = @deviceId,
          location_id = @locationId,
          captured_at = @capturedAt,
          file_name = @fileName,
          status = @status,
          file_size_bytes = @fileSizeBytes,
          checksum_sha256 = @checksumSha256,
          metadata_json = @metadataJson
        WHERE id = @recordId;
      `);

      await logCaptureCreated(data, operator, recordId, true);
      return { ok: true, recordId, locationId, replaced: true };
    }

    const result = await write.query(`
        INSERT INTO ${schema}.capture_records (
          device_id,
          location_id,
          captured_at,
          file_name,
          file_path,
          status,
          file_size_bytes,
          checksum_sha256,
          metadata_json
        )
        OUTPUT INSERTED.id
        VALUES (
          @deviceId,
          @locationId,
          @capturedAt,
          @fileName,
          @filePath,
          @status,
          @fileSizeBytes,
          @checksumSha256,
          @metadataJson
        );
      `);

    const insertedId = Number(result.recordset[0].id);
    await logCaptureCreated(data, operator, insertedId, false);
    return {
      ok: true,
      recordId: insertedId,
      locationId,
      replaced: false,
    };
  } catch (error) {
    return {
      ok: false,
      code: "CAPTURE_RECORD_FAILED",
      message:
        error instanceof Error ? error.message : "Gagal menyimpan metadata capture ke registry MSSQL.",
    };
  }
}
