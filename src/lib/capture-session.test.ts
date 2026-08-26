import { describe, expect, it } from "vitest";

import {
  CAPTURE_SESSION_HOURS,
  formatSessionLabel,
  isSessionOnAnotherDay,
  listSelectableSessions,
  resolveNearestSession,
  sessionPathSegment,
} from "./capture-session";

// Waktu lokal, bukan UTC: sesi ditentukan oleh jam dinding operator.
const at = (y: number, m: number, d: number, h: number, min = 0) => new Date(y, m - 1, d, h, min);

describe("formatSessionLabel", () => {
  it("memakai titik, bukan titik dua", () => {
    expect(formatSessionLabel(2)).toBe("02.00");
    expect(formatSessionLabel(23)).toBe("23.00");
  });
});

describe("resolveNearestSession", () => {
  it("memilih sesi yang sedang berjalan saat capture sedikit telat", () => {
    expect(resolveNearestSession(at(2026, 8, 25, 2, 7)).label).toBe("02.00");
    expect(resolveNearestSession(at(2026, 8, 25, 14, 20)).label).toBe("14.00");
  });

  // Inti dipilihnya "terdekat" dan bukan "sesi berjalan": operator yang datang
  // lima menit lebih awal sedang mengerjakan sesi berikutnya.
  it("memilih sesi berikutnya saat capture kepagian", () => {
    expect(resolveNearestSession(at(2026, 8, 25, 4, 55)).label).toBe("05.00");
    expect(resolveNearestSession(at(2026, 8, 25, 16, 30)).label).toBe("17.00");
  });

  it("melewati tengah malam ke sesi 23.00 hari sebelumnya", () => {
    const session = resolveNearestSession(at(2026, 8, 26, 0, 20));
    expect(session.label).toBe("23.00");
    expect(session.startsAt.getDate()).toBe(25);
  });

  // Pukul 00.30 berjarak persis 1,5 jam ke 23.00 dan ke 02.00. Sampling lebih
  // sering telat daripada kepagian, jadi yang lebih awal yang menang.
  it("memilih yang lebih awal saat jaraknya seri", () => {
    const session = resolveNearestSession(at(2026, 8, 26, 0, 30));
    expect(session.label).toBe("23.00");
    expect(session.startsAt.getDate()).toBe(25);
  });

  it("melewati tengah malam ke depan menjelang 02.00", () => {
    const session = resolveNearestSession(at(2026, 8, 25, 23, 55));
    expect(session.label).toBe("23.00");
    expect(session.startsAt.getDate()).toBe(25);
  });

  it("selalu mengembalikan salah satu jam sesi yang sah", () => {
    for (let hour = 0; hour < 24; hour++) {
      const session = resolveNearestSession(at(2026, 8, 25, hour, 33));
      expect(CAPTURE_SESSION_HOURS).toContain(session.hour);
    }
  });
});

describe("sessionPathSegment", () => {
  it("memakai tanggal SESI, bukan tanggal capture", () => {
    // Capture 26 Agustus pukul 00.20, tapi sesinya 23.00 tanggal 25.
    const session = resolveNearestSession(at(2026, 8, 26, 0, 20));
    expect(sessionPathSegment(session)).toBe("2026/08/25");
  });

  it("memakai nol di depan", () => {
    const session = resolveNearestSession(at(2026, 1, 5, 8, 10));
    expect(sessionPathSegment(session)).toBe("2026/01/05");
  });
});

describe("listSelectableSessions", () => {
  it("mengurutkan terbaru dulu dan memuat sesi terdekat", () => {
    const now = at(2026, 8, 25, 14, 20);
    const sessions = listSelectableSessions(now);
    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions.map((s) => s.label)).toContain("14.00");
    const times = sessions.map((s) => s.startsAt.getTime());
    expect([...times].sort((a, b) => b - a)).toEqual(times);
  });

  it("menjangkau sesi kemarin sesudah tengah malam", () => {
    const sessions = listSelectableSessions(at(2026, 8, 26, 0, 30));
    const yesterday = sessions.filter((s) => s.startsAt.getDate() === 25);
    expect(yesterday.map((s) => s.label)).toContain("23.00");
  });

  it("condong ke belakang: sesi lampau lebih banyak daripada sesi mendatang", () => {
    const now = at(2026, 8, 25, 14, 20);
    const sessions = listSelectableSessions(now);
    const past = sessions.filter((s) => s.startsAt.getTime() <= now.getTime()).length;
    const future = sessions.filter((s) => s.startsAt.getTime() > now.getTime()).length;
    expect(past).toBeGreaterThan(future);
  });
});

describe("isSessionOnAnotherDay", () => {
  it("menandai sesi kemarin supaya bisa diberi label di dropdown", () => {
    const now = at(2026, 8, 26, 0, 30);
    expect(isSessionOnAnotherDay(resolveNearestSession(now), now)).toBe(true);
    expect(
      isSessionOnAnotherDay(resolveNearestSession(at(2026, 8, 25, 14, 5)), at(2026, 8, 25, 14, 5)),
    ).toBe(false);
  });
});
