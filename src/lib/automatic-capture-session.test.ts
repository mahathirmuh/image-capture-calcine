import { describe, expect, it } from "vitest";
import { resolveAutomaticCaptureSession } from "../../mobile/src/lib/automaticCaptureSession";

const at = (day: number, hour: number, minute = 0) => new Date(2026, 8, day, hour, minute);
describe("direct capture windows", () => {
  it("opens at the start and closes exactly two hours later", () => {
    expect(resolveAutomaticCaptureSession("Acid Plant", at(8, 13, 59))).toBeNull();
    expect(resolveAutomaticCaptureSession("Acid Plant", at(8, 14))?.session).toBe("14.00");
    expect(resolveAutomaticCaptureSession("Acid Plant", at(8, 15, 59))?.session).toBe("14.00");
    expect(resolveAutomaticCaptureSession("Acid Plant", at(8, 16))).toBeNull();
  });
  it("keeps one context across midnight and closes it at 01:00", () => {
    const before = resolveAutomaticCaptureSession("Chloride Plant", at(8, 23, 59));
    const after = resolveAutomaticCaptureSession("Chloride Plant", at(9, 0, 59));
    expect(after?.key).toBe(before?.key);
    expect(after?.session).toBe("23.00");
    expect(resolveAutomaticCaptureSession("Chloride Plant", at(9, 1))).toBeNull();
  });
  it("requires explicit selection for ALL and missing plant", () => {
    for (const plant of [null, undefined, "", "ALL"]) {
      expect(resolveAutomaticCaptureSession(plant, at(8, 14))).toBeNull();
    }
  });
  it("uses a new identity each date even for the same session hour", () => {
    expect(resolveAutomaticCaptureSession("Acid Plant", at(8, 14))?.key).not.toBe(
      resolveAutomaticCaptureSession("Acid Plant", at(9, 14))?.key,
    );
  });
});
