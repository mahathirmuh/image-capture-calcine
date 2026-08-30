import { describe, expect, it } from "vitest";

import { resolveUserPlantScope } from "./operator-plant";
import { USER_PLANT_ALL } from "./user-admin";

describe("resolveUserPlantScope", () => {
  it("membebaskan akun Semua Plant", () => {
    expect(resolveUserPlantScope({ plant: USER_PLANT_ALL })).toEqual({
      plant: null,
      locked: false,
    });
  });

  it("mengunci akun yang dipasang ke plant tertentu", () => {
    expect(resolveUserPlantScope({ plant: "Acid Plant" })).toEqual({
      plant: "Acid Plant",
      locked: true,
    });
  });

  it("tidak membedakan admin dan operator; yang dipakai hanya penempatan plant", () => {
    expect(resolveUserPlantScope({ plant: "Chloride Plant" })).toEqual({
      plant: "Chloride Plant",
      locked: true,
    });
  });
});
