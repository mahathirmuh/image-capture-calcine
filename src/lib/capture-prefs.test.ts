import { describe, expect, it } from "vitest";

import { analyzeFilenamePattern } from "./capture-prefs";

describe("analyzeFilenamePattern", () => {
  it("accepts the default pattern and highlights duplicate-name risk honestly", () => {
    const analysis = analyzeFilenamePattern("{DD} {MMMM} {YYYY} {HH}.{mm} {LOCATION} {SOURCE}");

    expect(analysis.isValid).toBe(true);
    expect(analysis.recognizedTokens).toEqual([
      "DD",
      "MMMM",
      "YYYY",
      "HH",
      "mm",
      "LOCATION",
      "SOURCE",
    ]);
    expect(analysis.hasCollisionRisk).toBe(true);
    expect(analysis.warnings).toHaveLength(1);
  });

  it("flags unsupported tokens as errors", () => {
    const analysis = analyzeFilenamePattern("{YYYY}-{BADTOKEN}-{SOURCE}");

    expect(analysis.isValid).toBe(false);
    expect(analysis.unsupportedTokens).toEqual(["BADTOKEN"]);
    expect(analysis.errors[0]).toMatch(/BADTOKEN/);
  });

  it("warns when no dynamic token is present", () => {
    const analysis = analyzeFilenamePattern("calcine-capture");

    expect(analysis.isValid).toBe(true);
    expect(analysis.warnings[0]).toMatch(/tidak memakai token dinamis/i);
  });

  it("does not report collision risk when an index token is present", () => {
    const analysis = analyzeFilenamePattern("{YYYY}-{LOCATION}-{SOURCE}-{INDEX}");

    expect(analysis.isValid).toBe(true);
    expect(analysis.hasCollisionRisk).toBe(false);
    expect(analysis.warnings).toEqual([]);
  });

  it("rejects an empty pattern", () => {
    const analysis = analyzeFilenamePattern("   ");

    expect(analysis.isValid).toBe(false);
    expect(analysis.errors[0]).toMatch(/tidak boleh kosong/i);
  });
});
