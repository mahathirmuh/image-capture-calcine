import { describe, expect, it } from "vitest";

import {
  buildCaptureRecordMetadata,
  isLocalOnlySave,
  normalizeCaptureBinLabel,
  replaceFileNameInPath,
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

  // Acid Plant menyebut slotnya TRAIN, tapi kolom locations.bin tetap memakai
  // "Bin N" untuk semua plant. Tanpa pemetaan ini preferredBin jadi null dan
  // resolveLocationId kehilangan penyaring binnya.
  it("maps Acid Plant TRAIN slots onto the same DB bin vocabulary", () => {
    expect(normalizeCaptureBinLabel("TRAIN 1")).toBe("Bin 1");
    expect(normalizeCaptureBinLabel("train2")).toBe("Bin 2");
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
      // Capture dari sebelum skema sesi tidak mengirim nilai ini, dan metadata
      // tetap harus terbentuk -- bukan gagal atau kehilangan kunci lain.
      captureSession: null,
      // Tanpa argumen operator, atribusinya kosong. Ini jalur yang dipakai saat
      // sesi login tidak terbaca: capture tetap tercatat, sekadar tanpa nama.
      capturedByUserId: null,
      capturedBy: null,
      station: "Main Area",
      saveMethod: "edge-network",
      assetId: "asset-123",
    });
  });

  // Sesi disimpan sebagai data supaya "sesi 14.00 sudah ada belum?" bisa
  // dijawab dari registry, bukan dengan mengurai nama berkas yang bisa
  // bersuffix "(2)" atau sudah di-rename orang.
  it("carries the sampling session into metadata", () => {
    const metadata = buildCaptureRecordMetadata({ ...captureInput, captureSession: "02.00" });
    expect(metadata.captureSession).toBe("02.00");
  });

  // Atribusi datang dari argumen kedua, bukan dari input. Itu yang menahan
  // klien mengaku sebagai operator lain: nilainya distempel server dari cookie
  // sesi, dan tidak ada jalan memasukkannya lewat payload.
  it("stamps the operator from its own argument, never from the input", () => {
    const metadata = buildCaptureRecordMetadata(captureInput, { id: 7, name: "Budi" });
    expect(metadata.capturedBy).toBe("Budi");
    expect(metadata.capturedByUserId).toBe(7);

    const forged = buildCaptureRecordMetadata({
      ...captureInput,
      capturedBy: "Orang Lain",
      capturedByUserId: 99,
    } as unknown as typeof captureInput);
    expect(forged.capturedBy).toBeNull();
    expect(forged.capturedByUserId).toBeNull();
  });

  it("treats non-download save methods as saved", () => {
    expect(toCaptureRecordStatus("edge-network")).toBe("saved");
    expect(toCaptureRecordStatus("browser-folder")).toBe("saved");
  });

  it("replaces file names inside known save paths", () => {
    expect(
      replaceFileNameInPath(
        "\\\\server\\capture\\2026\\07\\22\\capture-old.jpg",
        "capture-old.jpg",
        "capture-new.jpg",
      ),
    ).toBe("\\\\server\\capture\\2026\\07\\22\\capture-new.jpg");
    expect(
      replaceFileNameInPath(
        "browser-download/capture-old.jpg",
        "capture-old.jpg",
        "capture-new.jpg",
      ),
    ).toBe("browser-download/capture-new.jpg");
  });
});

describe("isLocalOnlySave", () => {
  // Yang disembunyikan dari galeri: foto yang hanya ada di PC operator.
  it("menandai jalur cadangan browser sebagai lokal saja", () => {
    expect(isLocalOnlySave("browser-download")).toBe(true);
    expect(isLocalOnlySave("browser-folder")).toBe(true);
  });

  it("tidak menandai foto yang sudah di folder jaringan", () => {
    expect(isLocalOnlySave("app-network")).toBe(false);
    expect(isLocalOnlySave("edge-network")).toBe(false);
  });

  // Menyembunyikan `spooled` akan mengosongkan galeri justru selama gangguan
  // jaringan -- saat orang paling ingin memastikan fotonya terambil. Berkasnya
  // sudah aman di app server dan akan menyusul sendiri.
  it("tidak menyembunyikan foto yang masih mengantre", () => {
    expect(isLocalOnlySave("spooled")).toBe(false);
  });

  // Tidak diketahui != tidak tersimpan. Record lama dari sebelum medan ini
  // dicatat tidak boleh lenyap dari galeri.
  it("memperlakukan metode yang tidak diketahui sebagai bukan lokal saja", () => {
    expect(isLocalOnlySave(null)).toBe(false);
    expect(isLocalOnlySave(undefined)).toBe(false);
  });
});
