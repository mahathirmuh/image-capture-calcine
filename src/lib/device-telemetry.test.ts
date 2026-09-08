import { describe, expect, it } from "vitest";
import { deviceTelemetrySchema, telemetryCapacity, telemetryPercent } from "./device-telemetry";
export const telemetryFixture = {
  schemaVersion: 1,
  deviceId: "fixture-edge",
  sampledAt: "2026-09-08T14:00:00.000Z",
  identity: {
    scope: "host",
    hostname: "mini-pc",
    osName: "Ubuntu",
    platform: "linux",
    release: "6",
    arch: "x64",
  },
  cpu: { scope: "host", usagePercent: 0, sampleWindowMs: 250 },
  memory: { scope: "host", totalBytes: 8589934592, availableBytes: 4294967296, usedPercent: 50 },
  disk: {
    scope: "data-filesystem",
    path: "/app/data",
    totalBytes: null,
    availableBytes: null,
    usedPercent: null,
  },
  temperature: { scope: "host", celsius: null, sensor: null },
  uptimeSeconds: 100,
  network: {
    scope: "runtime",
    addresses: [{ interface: "eth0", address: "172.18.0.2", family: "IPv4" }],
  },
  unavailable: ["temperature", "disk"],
  qc: { status: "unsupported", reason: "No analysis pipeline" },
};
describe("device telemetry contract and presentation", () => {
  it("accepts partial snapshots, keeping host and container identities distinct", () => {
    const value = deviceTelemetrySchema.parse(telemetryFixture);
    expect(value.network.scope).toBe("runtime");
    expect(value.identity.scope).toBe("host");
    expect(value.temperature.celsius).toBeNull();
    expect(telemetryPercent(value.cpu.usagePercent)).toBe("0.0%");
    expect(telemetryCapacity(value.memory)).toBe("50.0% · 4.0 / 8.0 GiB tersedia");
    expect(telemetryCapacity(value.disk)).toBe("Tidak tersedia");
  });
  it("rejects malformed metrics and timestamps rather than displaying misleading readings", () => {
    expect(
      deviceTelemetrySchema.safeParse({
        ...telemetryFixture,
        cpu: { scope: "host", usagePercent: 101, sampleWindowMs: 250 },
      }).success,
    ).toBe(false);
    expect(deviceTelemetrySchema.safeParse({ ...telemetryFixture, sampledAt: "bad" }).success).toBe(
      false,
    );
    expect(deviceTelemetrySchema.safeParse({ ...telemetryFixture, schemaVersion: 2 }).success).toBe(
      false,
    );
  });
});
