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

const listCaptureRecordsSchema = z
  .object({
    limit: z.number().int().positive().max(500).default(200),
  })
  .optional();

const renameCaptureRecordSchema = z.object({
  recordId: z.number().int().positive().nullable().optional(),
  currentFileName: z.string().trim().min(1, "Nama file saat ini wajib diisi"),
  nextFileName: z.string().trim().min(1, "Nama file baru wajib diisi"),
  capturedAt: z.number().int().positive(),
});

const deleteCaptureRecordSchema = z.object({
  recordId: z.number().int().positive().nullable().optional(),
  fileName: z.string().trim().min(1, "Nama file wajib diisi"),
  capturedAt: z.number().int().positive(),
});

const captureDashboardSummarySchema = z.object({
  dayStart: z.number().int().positive(),
  dayEnd: z.number().int().positive(),
  weekStart: z.number().int().positive(),
  recentLimit: z.number().int().positive().max(20).default(6),
});

const logDeviceEventSchema = z.object({
  deviceCode: z.string().trim().min(1, "Device code wajib diisi"),
  eventType: z.string().trim().min(1, "Event type wajib diisi"),
  severity: z.enum(["info", "warning", "error"]),
  message: z.string().trim().min(1, "Message wajib diisi"),
  payload: z.record(z.string(), z.unknown()).optional(),
});

const listDeviceEventsSchema = z.object({
  limit: z.number().int().positive().max(50).default(10),
  deviceCode: z.string().trim().min(1).optional(),
  beforeId: z.number().int().positive().optional(),
  beforeCreatedAt: z.string().datetime().optional(),
});

export type CaptureRecordView = {
  id: number;
  deviceCode: string | null;
  deviceName: string | null;
  plant: string | null;
  captureBin: string | null;
  station: string | null;
  fileName: string;
  filePath: string;
  capturedAt: string;
  status: string;
  fileSizeBytes: number | null;
  checksumSha256: string | null;
  saveMethod: CaptureSaveMethod | null;
  assetId: string | null;
  createdAt: string;
};

export type CaptureDashboardSummary = {
  totalCount: number;
  todayCount: number;
  weekCount: number;
  totalBytes: number;
  lastCapturedAt: string | null;
  recentRecords: CaptureRecordView[];
  saveBreakdown: {
    saved: number;
    downloaded: number;
    other: number;
  };
};

export type DeviceEventSeverity = "info" | "warning" | "error";

export type DeviceEventView = {
  id: number;
  deviceCode: string;
  deviceName: string | null;
  eventType: string;
  severity: DeviceEventSeverity;
  message: string;
  payload: Record<string, unknown> | null;
  createdAt: string;
};

export type DeviceEventCursor = {
  id: number;
  createdAt: string;
};

export function replaceFileNameInPath(
  filePath: string,
  currentFileName: string,
  nextFileName: string,
) {
  if (!filePath) return filePath;
  if (filePath.endsWith(`/${currentFileName}`)) {
    return `${filePath.slice(0, -currentFileName.length)}${nextFileName}`;
  }
  if (filePath.endsWith(`\\${currentFileName}`)) {
    return `${filePath.slice(0, -currentFileName.length)}${nextFileName}`;
  }
  if (filePath === currentFileName) {
    return nextFileName;
  }
  return filePath;
}

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

function parseCaptureRecordMetadata(raw: unknown): {
  deviceCode: string | null;
  deviceName: string | null;
  plant: string | null;
  captureBin: string | null;
  station: string | null;
  saveMethod: CaptureSaveMethod | null;
  assetId: string | null;
} {
  let parsed: Record<string, unknown> = {};
  if (typeof raw === "string" && raw.trim() !== "") {
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      parsed = {};
    }
  } else if (typeof raw === "object" && raw !== null) {
    parsed = raw as Record<string, unknown>;
  }

  const saveMethod = CAPTURE_SAVE_METHODS.includes(parsed.saveMethod as CaptureSaveMethod)
    ? (parsed.saveMethod as CaptureSaveMethod)
    : null;

  return {
    deviceCode: typeof parsed.deviceCode === "string" ? parsed.deviceCode : null,
    deviceName: typeof parsed.deviceName === "string" ? parsed.deviceName : null,
    plant: typeof parsed.plant === "string" ? parsed.plant : null,
    captureBin: typeof parsed.captureBin === "string" ? parsed.captureBin : null,
    station: typeof parsed.station === "string" ? parsed.station : null,
    saveMethod,
    assetId: typeof parsed.assetId === "string" ? parsed.assetId : null,
  };
}

function mapCaptureRecordRow(row: Record<string, unknown>): CaptureRecordView {
  const metadata = parseCaptureRecordMetadata(row.metadata_json);
  return {
    id: Number(row.id),
    deviceCode: metadata.deviceCode,
    deviceName: metadata.deviceName,
    plant: metadata.plant ?? (typeof row.plant === "string" ? row.plant : null),
    captureBin: metadata.captureBin,
    station: metadata.station ?? (typeof row.station === "string" ? row.station : null),
    fileName: String(row.file_name ?? ""),
    filePath: String(row.file_path ?? ""),
    capturedAt: new Date(
      String(row.captured_at ?? row.created_at ?? new Date().toISOString()),
    ).toISOString(),
    status: String(row.status ?? ""),
    fileSizeBytes:
      typeof row.file_size_bytes === "number"
        ? row.file_size_bytes
        : Number(row.file_size_bytes ?? 0),
    checksumSha256: typeof row.checksum_sha256 === "string" ? row.checksum_sha256 : null,
    saveMethod: metadata.saveMethod,
    assetId: metadata.assetId,
    createdAt: new Date(String(row.created_at ?? new Date().toISOString())).toISOString(),
  };
}

function parseJsonRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function mapDeviceEventRow(row: Record<string, unknown>): DeviceEventView {
  const createdAt =
    row.created_at instanceof Date
      ? row.created_at.toISOString()
      : typeof row.created_at === "string"
        ? new Date(row.created_at).toISOString()
        : new Date(0).toISOString();

  return {
    id: Number(row.id),
    deviceCode: typeof row.device_code === "string" ? row.device_code : "unknown-device",
    deviceName: typeof row.device_name === "string" ? row.device_name : null,
    eventType: typeof row.event_type === "string" ? row.event_type : "unknown-event",
    severity:
      row.severity === "warning" || row.severity === "error" || row.severity === "info"
        ? row.severity
        : "info",
    message: typeof row.message === "string" ? row.message : "Tanpa pesan event",
    payload: parseJsonRecord(row.payload_json),
    createdAt,
  };
}

async function resolveCaptureRecordId(
  pool: sql.ConnectionPool,
  schema: string,
  input: {
    recordId?: number | null;
    fileName: string;
    capturedAt: number;
  },
): Promise<number | null> {
  if (input.recordId) return input.recordId;

  const result = await pool
    .request()
    .input("fileName", sql.NVarChar(255), input.fileName)
    .input("capturedAt", sql.DateTime2, new Date(input.capturedAt)).query(`
      SELECT TOP 1 id
      FROM ${schema}.capture_records
      WHERE file_name = @fileName
        AND ABS(DATEDIFF(second, captured_at, @capturedAt)) <= 120
      ORDER BY ABS(DATEDIFF(second, captured_at, @capturedAt)), id DESC;
    `);

  return result.recordset[0] ? Number(result.recordset[0].id) : null;
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

export const listCaptureRecords = createServerFn({ method: "GET" })
  .validator(listCaptureRecordsSchema)
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
      const limit = data?.limit ?? 200;
      const result = await pool.request().input("limit", sql.Int, limit).query(`
        SELECT TOP (@limit)
          cr.id,
          cr.file_name,
          cr.file_path,
          cr.captured_at,
          cr.status,
          cr.file_size_bytes,
          cr.checksum_sha256,
          cr.metadata_json,
          cr.created_at,
          l.plant,
          l.station
        FROM ${schema}.capture_records cr
        LEFT JOIN ${schema}.locations l
          ON l.id = cr.location_id
        ORDER BY cr.captured_at DESC, cr.id DESC;
      `);

      return {
        ok: true as const,
        records: result.recordset.map((row) => mapCaptureRecordRow(row as Record<string, unknown>)),
      };
    } catch (error) {
      return {
        ok: false as const,
        code: "CAPTURE_RECORD_LIST_FAILED",
        message:
          error instanceof Error
            ? error.message
            : "Gagal memuat riwayat capture dari registry MSSQL.",
      };
    }
  });

export const getCaptureDashboardSummary = createServerFn({ method: "GET" })
  .validator(captureDashboardSummarySchema)
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
      const aggregateResult = await pool
        .request()
        .input("dayStart", sql.DateTime2, new Date(data.dayStart))
        .input("dayEnd", sql.DateTime2, new Date(data.dayEnd))
        .input("weekStart", sql.DateTime2, new Date(data.weekStart)).query(`
          SELECT
            COUNT(*) AS total_count,
            SUM(CASE WHEN captured_at >= @dayStart AND captured_at < @dayEnd THEN 1 ELSE 0 END) AS today_count,
            SUM(CASE WHEN captured_at >= @weekStart AND captured_at < @dayEnd THEN 1 ELSE 0 END) AS week_count,
            SUM(COALESCE(file_size_bytes, 0)) AS total_bytes,
            MAX(captured_at) AS last_captured_at,
            SUM(CASE WHEN status = N'saved' THEN 1 ELSE 0 END) AS saved_count,
            SUM(CASE WHEN status = N'downloaded' THEN 1 ELSE 0 END) AS downloaded_count
          FROM ${schema}.capture_records;
        `);

      const aggregate = (aggregateResult.recordset[0] ?? {}) as Record<string, unknown>;
      const recentResult = await pool.request().input("limit", sql.Int, data.recentLimit).query(`
          SELECT TOP (@limit)
            cr.id,
            cr.file_name,
            cr.file_path,
            cr.captured_at,
            cr.status,
            cr.file_size_bytes,
            cr.checksum_sha256,
            cr.metadata_json,
            cr.created_at,
            l.plant,
            l.station
          FROM ${schema}.capture_records cr
          LEFT JOIN ${schema}.locations l
            ON l.id = cr.location_id
          ORDER BY cr.captured_at DESC, cr.id DESC;
        `);

      const totalCount = Number(aggregate.total_count ?? 0);
      const todayCount = Number(aggregate.today_count ?? 0);
      const weekCount = Number(aggregate.week_count ?? 0);
      const totalBytes = Number(aggregate.total_bytes ?? 0);
      const savedCount = Number(aggregate.saved_count ?? 0);
      const downloadedCount = Number(aggregate.downloaded_count ?? 0);

      return {
        ok: true as const,
        summary: {
          totalCount,
          todayCount,
          weekCount,
          totalBytes,
          lastCapturedAt:
            aggregate.last_captured_at instanceof Date
              ? aggregate.last_captured_at.toISOString()
              : typeof aggregate.last_captured_at === "string"
                ? new Date(aggregate.last_captured_at).toISOString()
                : null,
          recentRecords: recentResult.recordset.map((row) =>
            mapCaptureRecordRow(row as Record<string, unknown>),
          ),
          saveBreakdown: {
            saved: savedCount,
            downloaded: downloadedCount,
            other: Math.max(0, totalCount - savedCount - downloadedCount),
          },
        } satisfies CaptureDashboardSummary,
      };
    } catch (error) {
      return {
        ok: false as const,
        code: "CAPTURE_DASHBOARD_SUMMARY_FAILED",
        message:
          error instanceof Error
            ? error.message
            : "Gagal memuat ringkasan capture dari registry MSSQL.",
      };
    }
  });

export const listDeviceEvents = createServerFn({ method: "GET" })
  .validator(listDeviceEventsSchema)
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
      const request = pool.request().input("fetchLimit", sql.Int, data.limit + 1);
      const whereClauses: string[] = [];

      if (data.deviceCode) {
        request.input("deviceCode", sql.NVarChar(50), data.deviceCode);
        whereClauses.push("d.code = @deviceCode");
      }

      if (data.beforeId && data.beforeCreatedAt) {
        request
          .input("beforeId", sql.BigInt, data.beforeId)
          .input("beforeCreatedAt", sql.DateTime2, new Date(data.beforeCreatedAt));
        whereClauses.push(
          "(de.created_at < @beforeCreatedAt OR (de.created_at = @beforeCreatedAt AND de.id < @beforeId))",
        );
      }

      const result = await request.query(`
        SELECT TOP (@fetchLimit)
          de.id,
          d.code AS device_code,
          d.name AS device_name,
          de.event_type,
          de.severity,
          de.message,
          de.payload_json,
          de.created_at
        FROM ${schema}.device_events de
        INNER JOIN ${schema}.devices d
          ON d.id = de.device_id
        ${whereClauses.length > 0 ? `WHERE ${whereClauses.join("\n        AND ")}` : ""}
        ORDER BY de.created_at DESC, de.id DESC;
      `);

      const hasMore = result.recordset.length > data.limit;
      const eventRows = hasMore ? result.recordset.slice(0, data.limit) : result.recordset;
      const events = eventRows.map((row) => mapDeviceEventRow(row as Record<string, unknown>));
      const lastEvent = events.at(-1) ?? null;

      return {
        ok: true as const,
        events,
        hasMore,
        nextCursor: lastEvent
          ? ({
              id: lastEvent.id,
              createdAt: lastEvent.createdAt,
            } satisfies DeviceEventCursor)
          : null,
      };
    } catch (error) {
      return {
        ok: false as const,
        code: "DEVICE_EVENTS_LOAD_FAILED",
        message:
          error instanceof Error
            ? error.message
            : "Gagal memuat device events dari registry MSSQL.",
      };
    }
  });

export const logDeviceEvent = createServerFn({ method: "POST" })
  .validator(logDeviceEventSchema)
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
      const deviceId = await resolveDeviceId(pool.request(), schema, data.deviceCode);

      if (!deviceId) {
        return {
          ok: false as const,
          code: "DEVICE_NOT_FOUND",
          message: `Device ${data.deviceCode} belum terdaftar di registry MSSQL.`,
        };
      }

      const payloadJson = data.payload ? JSON.stringify(data.payload) : null;
      const result = await pool
        .request()
        .input("deviceId", sql.BigInt, deviceId)
        .input("eventType", sql.NVarChar(100), data.eventType)
        .input("severity", sql.NVarChar(20), data.severity)
        .input("message", sql.NVarChar(500), data.message)
        .input("payloadJson", sql.NVarChar(sql.MAX), payloadJson).query(`
          INSERT INTO ${schema}.device_events (
            device_id,
            event_type,
            severity,
            message,
            payload_json
          )
          OUTPUT INSERTED.id
          VALUES (
            @deviceId,
            @eventType,
            @severity,
            @message,
            @payloadJson
          );
        `);

      return {
        ok: true as const,
        eventId: Number(result.recordset[0].id),
      };
    } catch (error) {
      return {
        ok: false as const,
        code: "DEVICE_EVENT_LOG_FAILED",
        message:
          error instanceof Error ? error.message : "Gagal mencatat event device ke registry MSSQL.",
      };
    }
  });

export const renameCaptureRecord = createServerFn({ method: "POST" })
  .validator(renameCaptureRecordSchema)
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
      const recordId = await resolveCaptureRecordId(pool, schema, {
        recordId: data.recordId ?? null,
        fileName: data.currentFileName,
        capturedAt: data.capturedAt,
      });

      if (!recordId) {
        return {
          ok: false as const,
          code: "CAPTURE_RECORD_NOT_FOUND",
          message: "Record capture yang cocok tidak ditemukan di MSSQL.",
        };
      }

      const current = await pool.request().input("recordId", sql.BigInt, recordId).query(`
        SELECT TOP 1 file_path
        FROM ${schema}.capture_records
        WHERE id = @recordId;
      `);
      const currentFilePath =
        typeof current.recordset[0]?.file_path === "string" ? current.recordset[0].file_path : "";
      const nextFilePath = replaceFileNameInPath(
        currentFilePath,
        data.currentFileName,
        data.nextFileName,
      );

      await pool
        .request()
        .input("recordId", sql.BigInt, recordId)
        .input("nextFileName", sql.NVarChar(255), data.nextFileName)
        .input("nextFilePath", sql.NVarChar(500), nextFilePath).query(`
          UPDATE ${schema}.capture_records
          SET
            file_name = @nextFileName,
            file_path = @nextFilePath
          WHERE id = @recordId;
        `);

      return {
        ok: true as const,
        recordId,
        nextFilePath,
      };
    } catch (error) {
      return {
        ok: false as const,
        code: "CAPTURE_RECORD_RENAME_FAILED",
        message:
          error instanceof Error ? error.message : "Gagal menyinkronkan rename capture ke MSSQL.",
      };
    }
  });

export const deleteCaptureRecord = createServerFn({ method: "POST" })
  .validator(deleteCaptureRecordSchema)
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
      const recordId = await resolveCaptureRecordId(pool, schema, {
        recordId: data.recordId ?? null,
        fileName: data.fileName,
        capturedAt: data.capturedAt,
      });

      if (!recordId) {
        return {
          ok: false as const,
          code: "CAPTURE_RECORD_NOT_FOUND",
          message: "Record capture yang cocok tidak ditemukan di MSSQL.",
        };
      }

      await pool.request().input("recordId", sql.BigInt, recordId).query(`
        DELETE FROM ${schema}.capture_records
        WHERE id = @recordId;
      `);

      return {
        ok: true as const,
        recordId,
      };
    } catch (error) {
      return {
        ok: false as const,
        code: "CAPTURE_RECORD_DELETE_FAILED",
        message:
          error instanceof Error ? error.message : "Gagal menyinkronkan hapus capture ke MSSQL.",
      };
    }
  });
