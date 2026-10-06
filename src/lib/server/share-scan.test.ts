import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { joinNetworkPath } from "../network-path";
import {
  buildImportedMetadata,
  diffShareListing,
  listShareFiles,
  sharePathKey,
} from "./share-scan";

let root = "";

async function put(...segments: string[]) {
  const target = join(root, ...segments);
  await mkdir(join(target, ".."), { recursive: true });
  await writeFile(target, "x");
}

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "share-scan-"));
  // Bentuk yang ditulis aplikasi.
  await put("Acid Plant", "2026", "10", "05", "14.00 Train 1.jpg");
  await put("Acid Plant", "2026", "10", "05", "14.00 Train 2.jpg");
  await put("Acid Plant Trial", "2026", "10", "06", "02.00 Train 1.jpg");
  // Di luar rentang yang dipindai.
  await put("Acid Plant", "2026", "09", "01", "02.00 Train 1.jpg");
  await put("Acid Plant", "2025", "10", "05", "02.00 Train 1.jpg");
  // Ditaruh orang langsung di folder plant / folder bulan.
  await put("Acid Plant Trial", "IMG_0012.jpg");
  await put("Acid Plant", "2026", "10", "lepas.png");
  // Bukan foto, sampah sistem, dan folder yang bukan folder tanggal.
  await put("Acid Plant", "2026", "10", "05", "catatan.xlsx");
  await put("Acid Plant", "2026", "10", "05", "Thumbs.db");
  await put("Acid Plant", "Arsip", "lama.jpg");
  await put("Acid Plant", "2026", "10", "05", "ulang", "14.00 Train 1.jpg");
  // Folder yang tidak dikelola aplikasi.
  await put("Lain-lain", "2026", "10", "05", "02.00 Train 1.jpg");
});

afterAll(async () => {
  if (root) await rm(root, { recursive: true, force: true });
});

describe("listShareFiles", () => {
  it("finds date-folder files in range plus loose files, and nothing else", async () => {
    const listing = await listShareFiles(root, "2026-10-01", "2026-10-06");

    expect(listing.files.map((segments) => segments.join("/")).sort()).toEqual([
      "Acid Plant Trial/2026/10/06/02.00 Train 1.jpg",
      "Acid Plant Trial/IMG_0012.jpg",
      "Acid Plant/2026/10/05/14.00 Train 1.jpg",
      "Acid Plant/2026/10/05/14.00 Train 2.jpg",
      "Acid Plant/2026/10/lepas.png",
    ]);
    expect(listing.unsupported.map((segments) => segments.join("/"))).toEqual([
      "Acid Plant/2026/10/05/catatan.xlsx",
    ]);
    expect(listing.otherFolders.sort()).toEqual([
      "Acid Plant/2026/10/05/ulang",
      "Acid Plant/Arsip",
    ]);
  });

  it("reports which plant folders exist", async () => {
    const listing = await listShareFiles(root, "2026-10-01", "2026-10-06");
    expect(listing.folders.map((entry) => [entry.folder, entry.found])).toEqual([
      ["Acid Plant", true],
      ["Acid Plant Trial", true],
      ["Chloride Plant", false],
      ["Pyrite Plant", false],
      ["Copper Cathode Plant", false],
    ]);
  });

  it("follows the requested range across months", async () => {
    const listing = await listShareFiles(root, "2026-09-01", "2026-09-30");
    expect(listing.files.map((segments) => segments.join("/")).sort()).toEqual([
      "Acid Plant Trial/IMG_0012.jpg",
      "Acid Plant/2026/09/01/02.00 Train 1.jpg",
    ]);
  });

  it("returns an empty listing for a root that cannot be read", async () => {
    const listing = await listShareFiles(join(root, "tidak-ada"), "2026-10-01", "2026-10-06");
    expect(listing.files).toEqual([]);
    expect(listing.folders.every((entry) => !entry.found)).toBe(true);
  });
});

describe("diffShareListing", () => {
  it("separates new files, registered files and records whose file is gone", async () => {
    const listing = await listShareFiles(root, "2026-10-01", "2026-10-06");
    const at = (...segments: string[]) => joinNetworkPath(root, segments);

    const diff = diffShareListing(root, listing, [
      // Sudah terdaftar -- dengan ejaan huruf yang berbeda.
      {
        id: 1,
        filePath: at("Acid Plant", "2026", "10", "05", "14.00 TRAIN 1.JPG"),
        status: "saved",
      },
      // Berkasnya sudah dihapus orang dari folder yang dipindai.
      {
        id: 2,
        filePath: at("Acid Plant", "2026", "10", "05", "11.00 Train 1.jpg"),
        status: "saved",
      },
      // Masih di antrean app server: belum ada di share itu wajar.
      {
        id: 3,
        filePath: at("Acid Plant", "2026", "10", "05", "17.00 Train 1.jpg"),
        status: "pending",
      },
      // Folder di luar rentang tidak dibaca, jadi tidak bisa dinilai hilang.
      {
        id: 4,
        filePath: at("Acid Plant", "2026", "08", "01", "02.00 Train 1.jpg"),
        status: "saved",
      },
    ]);

    expect(diff.alreadyRegistered).toBe(1);
    expect(diff.newFiles.map((segments) => segments.join("/")).sort()).toEqual([
      "Acid Plant Trial/2026/10/06/02.00 Train 1.jpg",
      "Acid Plant Trial/IMG_0012.jpg",
      "Acid Plant/2026/10/05/14.00 Train 2.jpg",
      "Acid Plant/2026/10/lepas.png",
    ]);
    expect(diff.missing).toEqual([
      { recordId: 2, relativePath: "Acid Plant/2026/10/05/11.00 Train 1.jpg" },
    ]);
  });
});

describe("sharePathKey", () => {
  it("treats separator style and letter case as the same path", () => {
    expect(sharePathKey("\\\\10.1.1.44\\Data\\Acid Plant\\A.JPG")).toBe(
      sharePathKey("//10.1.1.44/Data/acid plant/a.jpg"),
    );
    expect(sharePathKey("/mnt/mti/Foto/")).toBe("/mnt/mti/foto");
  });
});

describe("buildImportedMetadata", () => {
  it("marks the row as imported and never names an operator or a device", () => {
    const metadata = buildImportedMetadata(
      {
        plant: "Acid Plant",
        track: "trial",
        sessionDate: "2026-10-06",
        session: "02.00",
        slot: 1,
        captureBin: "TRAIN 1",
      },
      { id: 7, username: "admin" },
      Date.parse("2026-10-06T01:00:00Z"),
      Date.parse("2026-10-06T03:00:00Z"),
    );

    expect(metadata).toMatchObject({
      source: "share-import",
      plant: "Acid Plant",
      captureTrack: "trial",
      captureSession: "02.00",
      captureBin: "TRAIN 1",
      capturedBy: null,
      capturedByUserId: null,
      deviceCode: null,
      saveMethod: "app-network",
      importedBy: "admin",
      importedByUserId: 7,
      fileModifiedAt: "2026-10-06T01:00:00.000Z",
    });
  });
});
