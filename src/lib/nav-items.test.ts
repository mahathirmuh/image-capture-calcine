import { describe, expect, it } from "vitest";

import { canRoleOpenPath, NAV_ITEMS, VIEWER_HOME } from "./nav-items";

describe("role access to pages", () => {
  it("lets a viewer open only the gallery", () => {
    const allowed = NAV_ITEMS.filter((item) => canRoleOpenPath("viewer", item.url)).map(
      (item) => item.url,
    );
    expect(allowed).toEqual([VIEWER_HOME]);
    expect(canRoleOpenPath("viewer", "/")).toBe(false);
    expect(canRoleOpenPath("viewer", "/devices/register")).toBe(false);
  });

  it("keeps operator and admin access unchanged", () => {
    expect(canRoleOpenPath("operator", "/capture")).toBe(true);
    expect(canRoleOpenPath("operator", "/gallery")).toBe(true);
    expect(canRoleOpenPath("operator", "/users")).toBe(false);
    expect(NAV_ITEMS.every((item) => canRoleOpenPath("admin", item.url))).toBe(true);
  });
});
