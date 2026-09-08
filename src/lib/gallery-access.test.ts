import { describe, expect, it } from "vitest";
import { canViewGalleryPlant, filterGalleryCache, resolveGalleryScope } from "./gallery-access";

describe("gallery plant policy", () => {
  it.each(["Acid Plant", "Chloride Plant"])("restricts operators to %s", (plant) => {
    const scope = resolveGalleryScope({ role: "operator", plant });
    expect(canViewGalleryPlant(scope, plant)).toBe(true);
    expect(
      canViewGalleryPlant(scope, plant === "Acid Plant" ? "Chloride Plant" : "Acid Plant"),
    ).toBe(false);
    expect(canViewGalleryPlant(scope, null)).toBe(false);
    expect(canViewGalleryPlant(scope, "")).toBe(false);
  });
  it.each([
    { role: "admin", plant: "Acid Plant" },
    { role: "operator", plant: "ALL" },
  ])("allows all plants only for explicit access %j", (user) => {
    const scope = resolveGalleryScope(user);
    expect(canViewGalleryPlant(scope, "Chloride Plant")).toBe(true);
    expect(canViewGalleryPlant(scope, null)).toBe(true);
  });
  it("fails closed while scope is loading or a plant is not assigned", () => {
    expect(canViewGalleryPlant(null, "Acid Plant")).toBe(false);
    expect(
      canViewGalleryPlant(resolveGalleryScope({ role: "operator", plant: null }), "Acid Plant"),
    ).toBe(false);
  });
  it("filters shared browser cache without restoring deleted or hidden records or mutating storage", () => {
    const items = [
      { folder: "Acid Plant", captureRecordId: 1 },
      { folder: "Chloride Plant", captureRecordId: 2 },
      { folder: "Acid Plant", captureRecordId: 99 },
      { folder: "Acid Plant", captureRecordId: 2 }, // local metadata disagrees with registry
      { folder: "Acid Plant" },
      { folder: "" },
    ];
    const records = [
      { id: 1, plant: "Acid Plant" },
      { id: 2, plant: "Chloride Plant" },
    ];
    expect(
      filterGalleryCache(
        items,
        resolveGalleryScope({ role: "operator", plant: "Acid Plant" }),
        records,
      ),
    ).toEqual([items[0], items[4]]);
    expect(filterGalleryCache(items, null, records)).toEqual([]);
    expect(items).toHaveLength(6);
  });
});
