import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  APERTURE_OPTIONS,
  DEFAULT_DEVICE_TEMPLATE_ID,
  DEVICE_BINS,
  DEVICE_SCHEDULES,
  DEVICE_STATIONS,
  DEVICE_TIMEZONES,
  FOCUS_MODE_OPTIONS,
  ISO_OPTIONS,
  PICTURE_STYLE_OPTIONS,
  SHUTTER_OPTIONS,
  WHITE_BALANCE_OPTIONS,
  createProfileFromInput,
  getTemplateById,
  getTemplateCameraSettings,
  type CameraSettings,
  type DeviceProfile,
} from "./device-config";
import { PLANTS } from "./locations";

const cameraSettingsSchema = z.object({
  iso: z.enum(ISO_OPTIONS),
  shutter: z.enum(SHUTTER_OPTIONS),
  aperture: z.enum(APERTURE_OPTIONS),
  whiteBalance: z.enum(WHITE_BALANCE_OPTIONS),
  pictureStyle: z.enum(PICTURE_STYLE_OPTIONS),
  focusMode: z.enum(FOCUS_MODE_OPTIONS),
});

const registryConfigSchema = z.object({
  templateId: z.string().default(DEFAULT_DEVICE_TEMPLATE_ID),
  schedule: z.string().default(DEVICE_SCHEDULES[1]),
  timezone: z.string().default(DEVICE_TIMEZONES[0]),
  cameraSettings: cameraSettingsSchema.optional(),
});

const upsertRegisteredDeviceInputSchema = z.object({
  deviceCode: z.string().trim().min(1, "Device code wajib diisi"),
  deviceName: z.string().trim().min(1, "Nama device wajib diisi"),
  plant: z.string().trim().min(1, "Plant wajib diisi"),
  bin: z.string().trim().min(1, "Bin wajib diisi"),
  station: z.string().trim().min(1, "Station wajib diisi"),
  description: z.string().default(""),
  templateId: z.string().default(DEFAULT_DEVICE_TEMPLATE_ID),
  schedule: z.string().default(DEVICE_SCHEDULES[1]),
  timezone: z.string().default(DEVICE_TIMEZONES[0]),
  cameraSettings: cameraSettingsSchema,
});

export type UpsertRegisteredDeviceInput = z.infer<typeof upsertRegisteredDeviceInputSchema>;

export type RegisteredDevice = {
  id: number;
  deviceCode: string;
  deviceName: string;
  plant: string;
  area: string | null;
  bin: string;
  station: string;
  description: string;
  templateId: string;
  schedule: string;
  timezone: string;
  cameraSettings: CameraSettings;
  serialNumber: string | null;
  ipAddress: string | null;
  connectionType: string | null;
  cameraModel: string | null;
  edgeApiUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

function parseRegistryConfig(raw: unknown) {
  let parsedJson: unknown = {};
  if (typeof raw === "string" && raw.trim() !== "") {
    try {
      parsedJson = JSON.parse(raw);
    } catch {
      parsedJson = {};
    }
  } else if (typeof raw === "object" && raw !== null) {
    parsedJson = raw;
  }

  const parsed = registryConfigSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return {
      templateId: DEFAULT_DEVICE_TEMPLATE_ID,
      schedule: DEVICE_SCHEDULES[1],
      timezone: DEVICE_TIMEZONES[0],
      cameraSettings: getTemplateCameraSettings(DEFAULT_DEVICE_TEMPLATE_ID),
    };
  }

  const templateId = getTemplateById(parsed.data.templateId).id;
  return {
    templateId,
    schedule: parsed.data.schedule,
    timezone: parsed.data.timezone,
    cameraSettings: parsed.data.cameraSettings ?? getTemplateCameraSettings(templateId),
  };
}

function mapRegisteredDeviceRow(row: Record<string, unknown>): RegisteredDevice {
  const config = parseRegistryConfig(row.config_json);
  return {
    id: Number(row.id),
    deviceCode: String(row.code ?? ""),
    deviceName: String(row.name ?? ""),
    plant: typeof row.plant === "string" && row.plant !== "" ? row.plant : PLANTS[0],
    area: typeof row.area === "string" && row.area !== "" ? row.area : null,
    bin: typeof row.bin === "string" && row.bin !== "" ? row.bin : DEVICE_BINS[0],
    station:
      typeof row.station === "string" && row.station !== "" ? row.station : DEVICE_STATIONS[0],
    description: typeof row.notes === "string" ? row.notes : "",
    templateId: config.templateId,
    schedule: config.schedule,
    timezone: config.timezone,
    cameraSettings: config.cameraSettings,
    serialNumber: typeof row.serial_number === "string" ? row.serial_number : null,
    ipAddress: typeof row.ip_address === "string" ? row.ip_address : null,
    connectionType: typeof row.connection_type === "string" ? row.connection_type : null,
    cameraModel: typeof row.camera_model === "string" ? row.camera_model : null,
    edgeApiUrl: typeof row.edge_api_url === "string" ? row.edge_api_url : null,
    isActive: Boolean(row.is_active),
    createdAt: new Date(String(row.created_at ?? new Date().toISOString())).toISOString(),
    updatedAt: new Date(String(row.updated_at ?? new Date().toISOString())).toISOString(),
  };
}

export function buildDeviceProfileFromRegisteredDevice(
  device: RegisteredDevice,
  existingProfile?: DeviceProfile | null,
) {
  return createProfileFromInput({
    deviceCode: device.deviceCode,
    deviceName: device.deviceName,
    plant: device.plant,
    bin: device.bin,
    station: device.station,
    description: device.description,
    templateId: device.templateId,
    schedule: device.schedule,
    timezone: device.timezone,
    cameraSettings: device.cameraSettings,
    edgeProfileId: existingProfile?.edgeProfileId ?? null,
    edgeLastAppliedAt: existingProfile?.edgeLastAppliedAt ?? null,
    registeredAt: existingProfile?.registeredAt ?? Date.parse(device.createdAt),
    updatedAt: existingProfile?.updatedAt ?? Date.parse(device.updatedAt),
  });
}

export function toUpsertRegisteredDeviceInput(profile: DeviceProfile): UpsertRegisteredDeviceInput {
  return {
    deviceCode: profile.deviceCode,
    deviceName: profile.deviceName,
    plant: profile.plant,
    bin: profile.bin,
    station: profile.station,
    description: profile.description,
    templateId: profile.templateId,
    schedule: profile.schedule,
    timezone: profile.timezone,
    cameraSettings: profile.cameraSettings,
  };
}

async function loadRegisteredDevicesFromDb(
  pool: {
    request: () => { query: (query: string) => Promise<{ recordset: unknown[] }> };
  },
  schema: string,
) {
  const result = await pool.request().query(`
    SELECT
      d.id,
      d.code,
      d.name,
      d.serial_number,
      d.ip_address,
      d.connection_type,
      d.camera_model,
      d.edge_api_url,
      d.notes,
      d.is_active,
      d.created_at,
      d.updated_at,
      l.plant,
      l.area,
      l.bin,
      l.station,
      cfg.config_json
    FROM ${schema}.devices d
    LEFT JOIN ${schema}.device_assignments da
      ON da.device_id = d.id
      AND da.is_current = 1
    LEFT JOIN ${schema}.locations l
      ON l.id = da.location_id
    OUTER APPLY (
      SELECT TOP 1 p.config_json
      FROM ${schema}.device_config_profiles p
      WHERE p.device_id = d.id
        AND p.is_active = 1
      ORDER BY p.updated_at DESC, p.id DESC
    ) cfg
    WHERE d.is_deleted = 0
    ORDER BY d.is_active DESC, d.name ASC;
  `);

  return result.recordset.map((row) => mapRegisteredDeviceRow(row as Record<string, unknown>));
}

export const listRegisteredDevices = createServerFn({ method: "GET" }).handler(async () => {
  const [{ getCardDbPool, getCardDbSchema, isCardDbConfigured }] = await Promise.all([
    import("./carddb"),
  ]);

  if (!isCardDbConfigured()) {
    return {
      ok: false as const,
      message: "Konfigurasi CARDDB belum lengkap di server aplikasi.",
    };
  }

  const schema = `[${getCardDbSchema()}]`;
  const pool = await getCardDbPool();
  return {
    ok: true as const,
    devices: await loadRegisteredDevicesFromDb(pool, schema),
  };
});

export const upsertRegisteredDeviceProfile = createServerFn({ method: "POST" })
  .validator(upsertRegisteredDeviceInputSchema)
  .handler(async ({ data }) => {
    const [{ getCardDbPool, getCardDbSchema, isCardDbConfigured }, sql] = await Promise.all([
      import("./carddb"),
      import("mssql"),
    ]);

    if (!isCardDbConfigured()) {
      return {
        ok: false as const,
        message: "Konfigurasi CARDDB belum lengkap di server aplikasi.",
      };
    }

    const schema = `[${getCardDbSchema()}]`;
    const pool = await getCardDbPool();
    const transaction = new sql.Transaction(pool);
    const configJson = JSON.stringify({
      templateId: getTemplateById(data.templateId).id,
      schedule: data.schedule,
      timezone: data.timezone,
      cameraSettings: data.cameraSettings,
    });

    try {
      await transaction.begin();

      const locationRequest = new sql.Request(transaction);
      locationRequest.input("plant", sql.NVarChar(100), data.plant);
      locationRequest.input("area", sql.NVarChar(100), null);
      locationRequest.input("bin", sql.NVarChar(100), data.bin);
      locationRequest.input("station", sql.NVarChar(100), data.station);
      locationRequest.input("notes", sql.NVarChar(500), data.description || null);

      const locationLookup = await locationRequest.query(`
        SELECT TOP 1 id
        FROM ${schema}.locations
        WHERE plant = @plant
          AND ISNULL(area, N'') = ISNULL(@area, N'')
          AND ISNULL(bin, N'') = ISNULL(@bin, N'')
          AND ISNULL(station, N'') = ISNULL(@station, N'');
      `);

      let locationId: number;
      if (locationLookup.recordset.length > 0) {
        locationId = Number(locationLookup.recordset[0].id);
        await new sql.Request(transaction)
          .input("locationId", sql.BigInt, locationId)
          .input("notes", sql.NVarChar(500), data.description || null).query(`
            UPDATE ${schema}.locations
            SET notes = COALESCE(@notes, notes),
                updated_at = SYSUTCDATETIME()
            WHERE id = @locationId;
          `);
      } else {
        const locationInsert = await locationRequest.query(`
          INSERT INTO ${schema}.locations (plant, area, bin, station, notes)
          OUTPUT INSERTED.id
          VALUES (@plant, @area, @bin, @station, @notes);
        `);
        locationId = Number(locationInsert.recordset[0].id);
      }

      const deviceRequest = new sql.Request(transaction);
      deviceRequest.input("code", sql.NVarChar(50), data.deviceCode);
      deviceRequest.input("name", sql.NVarChar(150), data.deviceName);
      deviceRequest.input("notes", sql.NVarChar(500), data.description || null);

      const deviceLookup = await deviceRequest.query(`
        SELECT TOP 1 id
        FROM ${schema}.devices
        WHERE code = @code
          AND is_deleted = 0;
      `);

      let deviceId: number;
      if (deviceLookup.recordset.length > 0) {
        deviceId = Number(deviceLookup.recordset[0].id);
        await new sql.Request(transaction)
          .input("deviceId", sql.BigInt, deviceId)
          .input("name", sql.NVarChar(150), data.deviceName)
          .input("notes", sql.NVarChar(500), data.description || null).query(`
            UPDATE ${schema}.devices
            SET name = @name,
                notes = @notes,
                is_active = 1,
                updated_at = SYSUTCDATETIME()
            WHERE id = @deviceId;
          `);
      } else {
        const deviceInsert = await deviceRequest.query(`
          INSERT INTO ${schema}.devices (code, name, notes, is_active, is_deleted)
          OUTPUT INSERTED.id
          VALUES (@code, @name, @notes, 1, 0);
        `);
        deviceId = Number(deviceInsert.recordset[0].id);
      }

      const assignmentLookup = await new sql.Request(transaction).input(
        "deviceId",
        sql.BigInt,
        deviceId,
      ).query(`
          SELECT TOP 1 id, location_id
          FROM ${schema}.device_assignments
          WHERE device_id = @deviceId
            AND is_current = 1
          ORDER BY assigned_from DESC, id DESC;
        `);

      const currentAssignment = assignmentLookup.recordset[0];
      if (!currentAssignment || Number(currentAssignment.location_id) !== locationId) {
        if (currentAssignment) {
          await new sql.Request(transaction).input(
            "assignmentId",
            sql.BigInt,
            Number(currentAssignment.id),
          ).query(`
              UPDATE ${schema}.device_assignments
              SET is_current = 0,
                  assigned_to = SYSUTCDATETIME()
              WHERE id = @assignmentId;
            `);
        }

        await new sql.Request(transaction)
          .input("deviceId", sql.BigInt, deviceId)
          .input("locationId", sql.BigInt, locationId).query(`
            INSERT INTO ${schema}.device_assignments (device_id, location_id, is_current)
            VALUES (@deviceId, @locationId, 1);
          `);
      }

      const profileLookup = await new sql.Request(transaction)
        .input("deviceId", sql.BigInt, deviceId)
        .input("profileName", sql.NVarChar(150), "default").query(`
          SELECT TOP 1 id, config_json
          FROM ${schema}.device_config_profiles
          WHERE device_id = @deviceId
            AND profile_name = @profileName
          ORDER BY updated_at DESC, id DESC;
        `);

      const currentProfileRow = profileLookup.recordset[0];
      let profileId: number;
      if (currentProfileRow) {
        profileId = Number(currentProfileRow.id);
        await new sql.Request(transaction)
          .input("profileId", sql.BigInt, profileId)
          .input("profileType", sql.NVarChar(50), "device-default")
          .input("configJson", sql.NVarChar(sql.MAX), configJson).query(`
            UPDATE ${schema}.device_config_profiles
            SET profile_type = @profileType,
                config_json = @configJson,
                is_active = 1,
                updated_at = SYSUTCDATETIME()
            WHERE id = @profileId;
          `);
      } else {
        const profileInsert = await new sql.Request(transaction)
          .input("deviceId", sql.BigInt, deviceId)
          .input("profileName", sql.NVarChar(150), "default")
          .input("profileType", sql.NVarChar(50), "device-default")
          .input("configJson", sql.NVarChar(sql.MAX), configJson).query(`
            INSERT INTO ${schema}.device_config_profiles (
              device_id,
              profile_name,
              profile_type,
              config_json,
              is_active
            )
            OUTPUT INSERTED.id
            VALUES (@deviceId, @profileName, @profileType, @configJson, 1);
          `);
        profileId = Number(profileInsert.recordset[0].id);
      }

      await new sql.Request(transaction)
        .input("deviceId", sql.BigInt, deviceId)
        .input("profileId", sql.BigInt, profileId)
        .input("changedBy", sql.NVarChar(100), "web-app")
        .input("changeSource", sql.NVarChar(50), "devices-ui")
        .input(
          "beforeJson",
          sql.NVarChar(sql.MAX),
          currentProfileRow?.config_json ? String(currentProfileRow.config_json) : null,
        )
        .input("afterJson", sql.NVarChar(sql.MAX), configJson)
        .input("notes", sql.NVarChar(500), "Profil device diperbarui dari web app").query(`
          INSERT INTO ${schema}.device_config_history (
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
            @changedBy,
            @changeSource,
            @beforeJson,
            @afterJson,
            @notes
          );
        `);

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      return {
        ok: false as const,
        message: error instanceof Error ? error.message : "Gagal menyimpan registry device ke DB.",
      };
    }

    const device =
      (await loadRegisteredDevicesFromDb(pool, schema)).find(
        (item) => item.deviceCode === data.deviceCode,
      ) ?? null;
    if (!device) {
      return {
        ok: false as const,
        message: "Data device tidak ditemukan setelah proses penyimpanan.",
      };
    }

    return {
      ok: true as const,
      device,
      profile: buildDeviceProfileFromRegisteredDevice(device),
    };
  });
