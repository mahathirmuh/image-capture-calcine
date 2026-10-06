import { describe, expect, it } from "vitest";

import {
  classifyShareFile,
  isShareImageFile,
  isShareNoiseFile,
  resolveImportedCapturedAt,
  sharePlantFolders,
  validateShareSyncRange,
} from "./share-import";

describe("classifyShareFile", () => {
  it("reads plant, date, session and slot from the path the app itself writes", () => {
    expect(classifyShareFile(["Acid Plant", "2026", "10", "05", "14.00 Train 1.jpg"])).toEqual({
      plant: "Acid Plant",
      track: "regular",
      sessionDate: "2026-10-05",
      session: "14.00",
      slot: 1,
      captureBin: "TRAIN 1",
    });
  });

  it("keeps trial files on Acid Plant but on the trial track", () => {
    expect(
      classifyShareFile(["Acid Plant Trial", "2026", "10", "05", "12.00 Train 2.jpg"]),
    ).toMatchObject({ plant: "Acid Plant", track: "trial", session: "12.00", slot: 2 });
  });

  it("uses the plant's own slot term whatever the file name says", () => {
    expect(
      classifyShareFile(["Chloride Plant", "2026", "10", "05", "02.00 train 2.JPG"]),
    ).toMatchObject({ plant: "Chloride Plant", captureBin: "BIN 2" });
  });

  it("accepts the common hand-typed spellings of a session", () => {
    const session = (name: string) => classifyShareFile(["Acid Plant", name])?.session;
    expect(session("2.00 Train 1.jpg")).toBe("02.00");
    expect(session("02:00 Train 1.jpg")).toBe("02.00");
    expect(session("0200 Train1.jpg")).toBe("02.00");
    expect(session("23.00_bin-2.png")).toBe("23.00");
  });

  it("does not invent a session from clock times, dates or counters", () => {
    const session = (name: string) => classifyShareFile(["Acid Plant", name])?.session;
    expect(session("14.25 Train 1.jpg")).toBeNull();
    expect(session("2026-10-05 foto.jpg")).toBeNull();
    expect(session("20261005.jpg")).toBeNull();
    expect(session("100 foto.jpg")).toBeNull();
    expect(session("25.00 Train 1.jpg")).toBeNull();
    expect(session("IMG_0012.jpg")).toBeNull();
  });

  it("registers a freely named file with the plant only", () => {
    expect(classifyShareFile(["Acid Plant Trial", "IMG_0012.jpg"])).toEqual({
      plant: "Acid Plant",
      track: "trial",
      sessionDate: null,
      session: null,
      slot: null,
      captureBin: null,
    });
  });

  it("does not read a slot out of an unrelated word", () => {
    expect(classifyShareFile(["Acid Plant", "cabin1.jpg"])?.slot).toBeNull();
    expect(classifyShareFile(["Acid Plant", "Train 12.jpg"])?.slot).toBeNull();
  });

  it("takes the date only from a complete, real date folder", () => {
    const date = (...folders: string[]) =>
      classifyShareFile(["Acid Plant", ...folders, "a.jpg"])?.sessionDate;
    expect(date("2026", "10")).toBeNull();
    expect(date("2026", "02", "30")).toBeNull();
    expect(date("2026", "10", "05", "lain")).toBeNull();
  });

  it("matches the plant folder without caring about letter case", () => {
    expect(classifyShareFile(["acid plant trial", "a.jpg"])?.track).toBe("trial");
  });

  it("rejects files outside a plant folder", () => {
    expect(classifyShareFile(["Arsip", "2026", "10", "05", "02.00 Train 1.jpg"])).toBeNull();
    expect(classifyShareFile(["02.00 Train 1.jpg"])).toBeNull();
    // Hanya Acid Plant yang punya jalur trial.
    expect(classifyShareFile(["Chloride Plant Trial", "a.jpg"])).toBeNull();
  });
});

describe("share file filters", () => {
  it("accepts only image types a browser can show", () => {
    expect(isShareImageFile("02.00 Train 1.jpg")).toBe(true);
    expect(isShareImageFile("foto.JPEG")).toBe(true);
    expect(isShareImageFile("foto.png")).toBe(true);
    expect(isShareImageFile("foto.heic")).toBe(false);
    expect(isShareImageFile("catatan.xlsx")).toBe(false);
    expect(isShareImageFile("tanpa-ekstensi")).toBe(false);
  });

  it("treats system leftovers as noise, not as skipped photos", () => {
    expect(isShareNoiseFile("Thumbs.db")).toBe(true);
    expect(isShareNoiseFile(".capture-app-write-test-1.tmp")).toBe(true);
    expect(isShareNoiseFile("~$laporan.xlsx")).toBe(true);
    expect(isShareNoiseFile("02.00 Train 1.jpg")).toBe(false);
  });

  it("lists the trial folder only for plants that have a trial track", () => {
    expect(sharePlantFolders().map((entry) => entry.folder)).toEqual([
      "Acid Plant",
      "Acid Plant Trial",
      "Chloride Plant",
      "Pyrite Plant",
      "Copper Cathode Plant",
    ]);
  });
});

describe("resolveImportedCapturedAt", () => {
  const info = (sessionDate: string | null, session: string | null) => ({
    plant: "Acid Plant",
    track: "regular" as const,
    sessionDate,
    session,
    slot: null,
    captureBin: null,
  });

  it("uses the start of the session in plant time (WITA, UTC+8)", () => {
    expect(resolveImportedCapturedAt(info("2026-10-05", "14.00"), 0)).toBe(
      Date.parse("2026-10-05T06:00:00Z"),
    );
    // Sesi 02.00 WITA jatuh pada tanggal UTC sebelumnya.
    expect(resolveImportedCapturedAt(info("2026-10-05", "02.00"), 0)).toBe(
      Date.parse("2026-10-04T18:00:00Z"),
    );
  });

  it("keeps the file time when it falls on the folder's date", () => {
    const modified = Date.parse("2026-10-05T03:30:00Z"); // 11.30 WITA, 5 Okt
    expect(resolveImportedCapturedAt(info("2026-10-05", null), modified)).toBe(modified);
  });

  it("follows the folder when the file time belongs to another day", () => {
    const modified = Date.parse("2026-09-01T03:30:00Z");
    expect(resolveImportedCapturedAt(info("2026-10-05", null), modified)).toBe(
      Date.parse("2026-10-04T16:00:00Z"), // 00.00 WITA, 5 Okt
    );
  });

  it("falls back to the file time when the path says nothing", () => {
    const modified = Date.parse("2026-09-01T03:30:00Z");
    expect(resolveImportedCapturedAt(info(null, "14.00"), modified)).toBe(modified);
    expect(resolveImportedCapturedAt(info(null, null), modified)).toBe(modified);
  });
});

describe("validateShareSyncRange", () => {
  it("accepts a normal range and a single day", () => {
    expect(validateShareSyncRange("2026-09-30", "2026-10-06")).toBeNull();
    expect(validateShareSyncRange("2026-10-06", "2026-10-06")).toBeNull();
    expect(validateShareSyncRange("2026-07-07", "2026-10-06")).toBeNull(); // tepat 92 hari
  });

  it("rejects broken, reversed and over-long ranges", () => {
    expect(validateShareSyncRange("2026-02-30", "2026-03-01")).not.toBeNull();
    expect(validateShareSyncRange("", "2026-03-01")).not.toBeNull();
    expect(validateShareSyncRange("2026-10-06", "2026-10-05")).not.toBeNull();
    expect(validateShareSyncRange("2026-07-06", "2026-10-06")).not.toBeNull(); // 93 hari
  });
});
