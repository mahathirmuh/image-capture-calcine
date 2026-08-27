import { describe, expect, it } from "vitest";

import {
  buildSessionCoverage,
  parseSessionLabel,
  resolveRecordSessionDate,
  sessionDateFromCapturedAt,
  sessionDateFromPath,
  type CoverageRecord,
} from "./session-coverage";

function record(overrides: Partial<CoverageRecord> = {}): CoverageRecord {
  return {
    id: 1,
    fileName: "14.00 Train 1.jpg",
    filePath: "/mnt/mti/Foto Sampling/Acid Plant/2026/08/27/14.00 Train 1.jpg",
    capturedAt: "2026-08-27T06:05:00.000Z",
    captureSession: "14.00",
    captureBin: "TRAIN 1",
    plant: "Acid Plant",
    status: "saved",
    capturedBy: "Budi",
    ...overrides,
  };
}

describe("sessionDateFromPath", () => {
  it("membaca YYYY/MM/DD dari path Linux", () => {
    expect(sessionDateFromPath("/mnt/mti/Acid Plant/2026/08/27/14.00 Train 1.jpg")).toBe(
      "2026-08-27",
    );
  });

  it("membaca YYYY\\MM\\DD dari path UNC Windows", () => {
    expect(
      sessionDateFromPath("\\\\10.1.1.44\\Data\\Acid Plant\\2026\\08\\27\\14.00 Train 1.jpg"),
    ).toBe("2026-08-27");
  });

  // Root-nya sendiri bisa mengandung angka -- "10.1.1.44" atau folder proyek
  // bertahun. Yang dipakai harus segmen tanggal TERAKHIR, bukan yang pertama
  // kebetulan cocok.
  it("memakai kecocokan terakhir saat root memuat angka", () => {
    expect(sessionDateFromPath("/data/2019/01/02/Acid Plant/2026/08/27/foto.jpg")).toBe(
      "2026-08-27",
    );
  });

  it("mengembalikan null kalau tidak ada segmen tanggal", () => {
    expect(sessionDateFromPath("/mnt/mti/Acid Plant/14.00 Train 1.jpg")).toBeNull();
    expect(sessionDateFromPath("")).toBeNull();
  });

  it("menolak bulan atau tanggal yang mustahil", () => {
    expect(sessionDateFromPath("/mnt/2026/13/27/foto.jpg")).toBeNull();
    expect(sessionDateFromPath("/mnt/2026/08/45/foto.jpg")).toBeNull();
  });
});

describe("sessionDateFromCapturedAt", () => {
  // Inilah alasan modul ini ada: sesi 23.00 dikerjakan lewat tengah malam,
  // jadi jam dindingnya sudah hari berikutnya sementara sesinya milik kemarin.
  it("menempatkan capture pukul 00.30 pada sesi 23.00 hari sebelumnya", () => {
    const capturedAt = new Date(2026, 7, 28, 0, 30);
    expect(sessionDateFromCapturedAt(capturedAt, 23)).toBe("2026-08-27");
  });

  it("memakai hari yang sama untuk sesi siang", () => {
    const capturedAt = new Date(2026, 7, 27, 14, 5);
    expect(sessionDateFromCapturedAt(capturedAt, 14)).toBe("2026-08-27");
  });

  it("menempatkan capture pukul 23.50 pada sesi 02.00 keesokan harinya", () => {
    const capturedAt = new Date(2026, 7, 27, 23, 50);
    expect(sessionDateFromCapturedAt(capturedAt, 2)).toBe("2026-08-28");
  });
});

describe("parseSessionLabel", () => {
  it("mengenali label sesi yang sah", () => {
    expect(parseSessionLabel("02.00")).toBe(2);
    expect(parseSessionLabel("23.00")).toBe(23);
    expect(parseSessionLabel(" 14.00 ")).toBe(14);
  });

  // Jadwalnya delapan sesi bertetapan tiga jam. Jam di luar itu bukan sesi,
  // dan menerimanya akan memunculkan baris cakupan yang tidak pernah ada.
  it("menolak jam yang bukan jadwal sesi", () => {
    expect(parseSessionLabel("03.00")).toBeNull();
    expect(parseSessionLabel("14.30")).toBeNull();
    expect(parseSessionLabel("bukan jam")).toBeNull();
    expect(parseSessionLabel(null)).toBeNull();
  });
});

describe("resolveRecordSessionDate", () => {
  // Path ditulis saat berkas dinamai dan sudah memuat keputusan tanggal sesi
  // tanpa zona waktu apa pun; menghitung ulang di server bisa memakai TZ
  // container yang berbeda dari TZ plant.
  it("mendahulukan tanggal dari path daripada dari waktu capture", () => {
    const value = resolveRecordSessionDate(
      record({
        filePath: "/mnt/mti/Acid Plant/2026/08/26/23.00 Train 1.jpg",
        captureSession: "23.00",
        capturedAt: new Date(2026, 7, 27, 0, 30).toISOString(),
      }),
    );
    expect(value).toBe("2026-08-26");
  });

  it("jatuh ke waktu capture kalau path tidak memuat tanggal", () => {
    const value = resolveRecordSessionDate(
      record({
        filePath: "C:/Users/ops/Downloads/23.00 Train 1.jpg",
        captureSession: "23.00",
        capturedAt: new Date(2026, 7, 28, 0, 30).toISOString(),
      }),
    );
    expect(value).toBe("2026-08-27");
  });

  it("mengembalikan null kalau sesinya tidak diketahui dan path tanpa tanggal", () => {
    expect(
      resolveRecordSessionDate(record({ filePath: "foto.jpg", captureSession: null })),
    ).toBeNull();
  });
});

describe("buildSessionCoverage", () => {
  it("menghitung 8 sesi x 2 slot per plant", () => {
    const coverage = buildSessionCoverage({
      date: "2026-08-27",
      plants: ["Acid Plant"],
      records: [],
    });

    expect(coverage.plants[0].sessions).toHaveLength(8);
    expect(coverage.plants[0].sessions[0].slots).toHaveLength(2);
    expect(coverage.summary).toEqual({ expected: 16, captured: 0, missing: 16 });
  });

  it("menandai slot yang sudah ada capture-nya", () => {
    const coverage = buildSessionCoverage({
      date: "2026-08-27",
      plants: ["Acid Plant"],
      records: [record()],
    });

    const session = coverage.plants[0].sessions.find((one) => one.session === "14.00");
    expect(session?.slots[0].captured).toBe(true);
    expect(session?.slots[0].record?.id).toBe(1);
    expect(session?.slots[1].captured).toBe(false);
    expect(coverage.summary).toEqual({ expected: 16, captured: 1, missing: 15 });
  });

  it("memakai sebutan slot milik plant yang bersangkutan", () => {
    const acid = buildSessionCoverage({ date: "2026-08-27", plants: ["Acid Plant"], records: [] });
    const chloride = buildSessionCoverage({
      date: "2026-08-27",
      plants: ["Chloride Plant"],
      records: [],
    });

    expect(acid.plants[0].sessions[0].slots[0].label).toBe("Train 1");
    expect(chloride.plants[0].sessions[0].slots[0].label).toBe("Bin 1");
  });

  // Capture ulang di sesi yang sama MENIMPA berkasnya di share, tapi tiap
  // percobaan meninggalkan barisnya sendiri di registry. Yang menggambarkan
  // berkas yang benar-benar ada di sana adalah tulisan terakhir.
  it("mengambil record terbaru saat satu slot punya beberapa percobaan", () => {
    const coverage = buildSessionCoverage({
      date: "2026-08-27",
      plants: ["Acid Plant"],
      records: [
        record({ id: 1, capturedAt: "2026-08-27T06:05:00.000Z" }),
        record({ id: 2, capturedAt: "2026-08-27T06:40:00.000Z" }),
      ],
    });

    const session = coverage.plants[0].sessions.find((one) => one.session === "14.00");
    expect(session?.slots[0].record?.id).toBe(2);
    expect(coverage.summary.captured).toBe(1);
  });

  it("tidak menghitung record dari plant atau tanggal lain", () => {
    const coverage = buildSessionCoverage({
      date: "2026-08-27",
      plants: ["Acid Plant"],
      records: [
        record({ id: 2, plant: "Chloride Plant" }),
        record({
          id: 3,
          filePath: "/mnt/mti/Acid Plant/2026/08/26/14.00 Train 1.jpg",
        }),
      ],
    });

    expect(coverage.summary.captured).toBe(0);
  });

  it("menjumlahkan ringkasan seluruh plant", () => {
    const coverage = buildSessionCoverage({
      date: "2026-08-27",
      plants: ["Acid Plant", "Chloride Plant"],
      records: [record()],
    });

    expect(coverage.summary).toEqual({ expected: 32, captured: 1, missing: 31 });
  });
});
