import { describe, expect, it } from "vitest";

import { loginInputSchema, toSafeRedirect } from "./auth";

describe("toSafeRedirect", () => {
  it("keeps an internal path", () => {
    expect(toSafeRedirect("/gallery")).toBe("/gallery");
    expect(toSafeRedirect("/devices/register?tab=camera")).toBe("/devices/register?tab=camera");
  });

  it("falls back when there is no target", () => {
    expect(toSafeRedirect(undefined)).toBe("/dashboard");
    expect(toSafeRedirect("")).toBe("/dashboard");
  });

  it("refuses to bounce the operator off-site after they type a password", () => {
    expect(toSafeRedirect("https://situs-lain.example/panen")).toBe("/dashboard");
    expect(toSafeRedirect("//situs-lain.example/panen")).toBe("/dashboard");
    expect(toSafeRedirect("javascript:alert(1)")).toBe("/dashboard");
  });

  it("never sends a freshly logged-in operator back to the login screen", () => {
    expect(toSafeRedirect("/login")).toBe("/dashboard");
    expect(toSafeRedirect("/login?redirect=%2Fcapture")).toBe("/dashboard");
  });
});

describe("loginInputSchema", () => {
  it("trims the identifier but leaves the password byte-for-byte", () => {
    const parsed = loginInputSchema.parse({
      identifier: "  operator.bin1  ",
      password: "  spasi penting  ",
    });

    expect(parsed.identifier).toBe("operator.bin1");
    expect(parsed.password).toBe("  spasi penting  ");
  });

  it("rejects empty fields with operator-facing copy", () => {
    const result = loginInputSchema.safeParse({ identifier: "   ", password: "" });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toEqual([
      "Username atau email wajib diisi",
      "Password wajib diisi",
    ]);
  });
});
