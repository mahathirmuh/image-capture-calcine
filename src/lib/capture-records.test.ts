import { describe, expect, it } from "vitest";

import {
  buildCaptureRecordMetadata,
  normalizeCaptureBinLabel,
  toCaptureRecordStatus,
  type RecordCaptureInput,
} from "./capture-records";

const captureInput: RecordCaptureInput = {
  deviceCode: "edge-camera-01",
  deviceName: "EDGE-CAMERA-01",
  plant: "Acid Plant",
  captureBin: "BIN 1",
  station: "Main Area",
  fileName: "capture-001.jpg",
  filePath: "\\\\server\\share\\2026\\07\\22\\capture-001.jpg",
  saveMethod: "edge-network",
  capturedAt: Date.parse("2026-07-22T10:00:00.000Z"),
  fileSizeBytes: 123456,
  checksumSha256: "a".repeat(64),
  assetId: "asset-123",
};

describe("capture-records helpers", () => {
  it("normalizes capture bin labels for DB location lookup", () => {
    expect(normalizeCaptureBinLabel("BIN 1")).toBe("Bin 1");
    expect(normalizeCaptureBinLabel("bin2")).toBe("Bin 2");
    expect(normalizeCaptureBinLabel("BIN 1 / BIN 2")).toBe("Bin 1 / Bin 2");
    expect(normalizeCaptureBinLabel("UNKNOWN")).toBeNull();
  });

  it("maps browser download records to downloaded status", () => {
    expect(toCaptureRecordStatus("edge-network")).toBe("saved");
    expect(toCaptureRecordStatus("browser-folder")).toBe("saved");
    expect(toCaptureRecordStatus("browser-download")).toBe("downloaded");
  });

  it("builds metadata payload for audit and diagnostics", () => {
    expect(buildCaptureRecordMetadata(captureInput)).toEqual({
      source: "capture-page",
      deviceCode: "edge-camera-01",
      deviceName: "EDGE-CAMERA-01",
      plant: "Acid Plant",
      captureBin: "BIN 1",
      station: "Main Area",
      saveMethod: "edge-network",
      assetId: "asset-123",
    });
  });
});
