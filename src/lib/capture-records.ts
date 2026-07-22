import sql from "mssql";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { getCardDbPool, getCardDbSchema, isCardDbConfigured } from "./carddb";

export const CAPTURE_SAVE_METHODS = ["edge-network", "browser-folder", "browser-download"] as const;
export type CaptureSaveMethod = (typeof CAPTURE_SAVE_METHODS)[number];

const captureSaveMethodSchema = z.enum(CAPTURE_SAVE_METHODS);

const recordCaptureSchema = z.object({
  deviceCode: z.string().trim().min(1, "Device code wajib diisi"),
  deviceName: z.string().trim().nullable().optional(),
  plant: z.string().trim().min(1, "Plant wajib diisi"),
  captureBin: z.string().trim().min(1, "Bin capture wajib diisi"),
  station: z.string().trim().nullable().optional(),
  fileName: z.string().trim().min(1, "Nama file wajib diisi"),
  filePath: z.string().trim().min(1, "Path file wajib diisi"),
  saveMethod: captureSaveMethodSchema,
  capturedAt: z.number().int().positive(),
  fileSizeBytes: z.number().int().nonnegative(),
  checksumSha256: z
    .string()
    .trim()
    .regex(/^[A-Fa-f0-9]{64}$/, "Checksum SHA-256 harus berupa 64 digit hex")
    .nullable()
    .optional(),
  assetId: z.string().trim().nullable().optional(),
});

export type RecordCaptureInput = z.infer<typeof recordCaptureSchema>;

export function normalizeCaptureBinLabel(value: string): string | null {
  const normalized = value.trim().toUpperCase();
  if (normalized === "BIN 1" || normalized === "BIN1") return "Bin 1";
  if (normalized === "BIN 2" || normalized === "BIN2") return "Bin 2";
  if (normalized === "BIN 1 / BIN 2" || normalized === "BIN1/BIN2") return "Bin 1 / Bin 2";
  return null;
}

export function toCaptureRecordStatus(saveMethod: CaptureSaveMethod) {
  return saveMethod === "browser-download" ? "downloaded" : "saved";
}

export function buildCaptureRecordMetadata(input: RecordCaptureInput) {
  return {
    source: "capture-page",
    deviceCode: input.deviceCode,
    deviceName: input.deviceName ?? null,
    plant: input.plant,
    captureBin: input.captureBin,
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

export const recordCaptureResult = createServerFn({ method: "POST" })
  .validator(recordCaptureSchema)
  .handler(async ({ data }) => {
    if (!isCardDbConfigured()) {
      return {
        ok: false as const,
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
          ok: false as const,
          code: "DEVICE_NOT_FOUND",
          message: `Device ${data.deviceCode} belum terdaftar di registry MSSQL.`,
        };
      }

      const locationId = await resolveLocationId(pool.request(), schema, data, deviceId);
      const metadataJson = JSON.stringify(buildCaptureRecordMetadata(data));
      const result = await pool
        .request()
        .input("deviceId", sql.BigInt, deviceId)
        .input("locationId", sql.BigInt, locationId)
        .input("capturedAt", sql.DateTime2, new Date(data.capturedAt))
        .input("fileName", sql.NVarChar(255), data.fileName)
        .input("filePath", sql.NVarChar(500), data.filePath)
        .input("status", sql.NVarChar(30), toCaptureRecordStatus(data.saveMethod))
        .input("fileSizeBytes", sql.BigInt, data.fileSizeBytes)
        .input("checksumSha256", sql.NVarChar(64), data.checksumSha256 ?? null)
        .input("metadataJson", sql.NVarChar(sql.MAX), metadataJson).query(`
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

      return {
        ok: true as const,
        recordId: Number(result.recordset[0].id),
        locationId,
      };
    } catch (error) {
      return {
        ok: false as const,
        code: "CAPTURE_RECORD_FAILED",
        message:
          error instanceof Error
            ? error.message
            : "Gagal menyimpan metadata capture ke registry MSSQL.",
      };
    }
  });
