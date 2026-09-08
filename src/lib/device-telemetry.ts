import { z } from "zod";
const nullableNumber = z.number().finite().nonnegative().nullable();
const percent = z.number().finite().min(0).max(100).nullable();
const scope = z.enum(["host", "runtime"]);
export const deviceTelemetrySchema = z.object({
  schemaVersion: z.literal(1),
  deviceId: z.string(),
  sampledAt: z.string().datetime(),
  identity: z.object({
    scope,
    hostname: z.string().nullable(),
    osName: z.string().nullable(),
    platform: z.string(),
    release: z.string(),
    arch: z.string(),
  }),
  cpu: z.object({
    scope: z.literal("host"),
    usagePercent: percent,
    sampleWindowMs: z.number().finite().nonnegative(),
  }),
  memory: z.object({
    scope: z.literal("host"),
    totalBytes: nullableNumber,
    availableBytes: nullableNumber,
    usedPercent: percent,
  }),
  disk: z.object({
    scope: z.literal("data-filesystem"),
    path: z.string(),
    totalBytes: nullableNumber,
    availableBytes: nullableNumber,
    usedPercent: percent,
  }),
  temperature: z.object({
    scope: z.literal("host"),
    celsius: z.number().finite().min(-20).max(150).nullable(),
    sensor: z.string().nullable(),
  }),
  uptimeSeconds: nullableNumber,
  network: z.object({
    scope,
    addresses: z.array(
      z.object({ interface: z.string(), address: z.string(), family: z.enum(["IPv4", "IPv6"]) }),
    ),
  }),
  unavailable: z.array(z.string()),
  qc: z.object({ status: z.literal("unsupported"), reason: z.string() }),
});
export type DeviceTelemetry = z.infer<typeof deviceTelemetrySchema>;
export function telemetryPercent(value: number | null | undefined) {
  return value == null ? "Tidak tersedia" : `${value.toFixed(1)}%`;
}
export function telemetryCapacity(
  value: DeviceTelemetry["memory"] | DeviceTelemetry["disk"] | undefined,
) {
  if (!value || value.totalBytes == null || value.availableBytes == null) return "Tidak tersedia";
  const gib = (bytes: number) => (bytes / 1024 ** 3).toFixed(1);
  return `${telemetryPercent(value.usedPercent)} · ${gib(value.availableBytes)} / ${gib(value.totalBytes)} GiB tersedia`;
}
