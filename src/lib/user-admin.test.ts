import { describe, expect, it } from "vitest";

import { describeUserChange } from "./activity-log";
import {
  createUserSchema,
  guardUserDeletion,
  guardUserUpdate,
  updateUserSchema,
} from "./user-admin";

const admin = { id: 1, username: "admin", role: "admin", isActive: true };
const operator = { id: 2, username: "operator.bin1", role: "operator", isActive: true };

describe("guardUserUpdate", () => {
  it("lets an admin edit somebody else while other admins remain", () => {
    expect(
      guardUserUpdate({
        actorId: 1,
        target: operator,
        next: { role: "admin", isActive: true },
        otherActiveAdmins: 1,
      }),
    ).toBeNull();
  });

  it("refuses to let an admin deactivate their own account", () => {
    const blocked = guardUserUpdate({
      actorId: 1,
      target: admin,
      next: { role: "admin", isActive: false },
      otherActiveAdmins: 5,
    });

    expect(blocked).toMatch(/tidak bisa menonaktifkan akun Anda sendiri/i);
  });

  it("refuses to let an admin drop their own admin role", () => {
    const blocked = guardUserUpdate({
      actorId: 1,
      target: admin,
      next: { role: "operator", isActive: true },
      otherActiveAdmins: 5,
    });

    expect(blocked).toMatch(/melepas peran Super Admin dari akun Anda sendiri/i);
  });

  it("refuses to demote the last active admin, even by another admin", () => {
    const blocked = guardUserUpdate({
      actorId: 9,
      target: admin,
      next: { role: "operator", isActive: true },
      otherActiveAdmins: 0,
    });

    expect(blocked).toMatch(/satu-satunya Super Admin aktif/i);
  });

  it("refuses to deactivate the last active admin", () => {
    const blocked = guardUserUpdate({
      actorId: 9,
      target: admin,
      next: { role: "admin", isActive: false },
      otherActiveAdmins: 0,
    });

    expect(blocked).toMatch(/satu-satunya Super Admin aktif/i);
  });

  it("allows demoting an admin once a second active admin exists", () => {
    expect(
      guardUserUpdate({
        actorId: 9,
        target: admin,
        next: { role: "operator", isActive: true },
        otherActiveAdmins: 1,
      }),
    ).toBeNull();
  });

  it("does not count an already-inactive admin as the last one", () => {
    // Menonaktifkan akun yang memang sudah nonaktif tidak mengurangi jumlah
    // admin aktif, jadi tidak ada yang perlu dilindungi.
    expect(
      guardUserUpdate({
        actorId: 9,
        target: { ...admin, isActive: false },
        next: { role: "operator", isActive: false },
        otherActiveAdmins: 0,
      }),
    ).toBeNull();
  });

  it("allows promoting an operator to admin", () => {
    expect(
      guardUserUpdate({
        actorId: 1,
        target: operator,
        next: { role: "admin", isActive: true },
        otherActiveAdmins: 0,
      }),
    ).toBeNull();
  });
});

describe("guardUserDeletion", () => {
  it("refuses self-deletion", () => {
    const blocked = guardUserDeletion({ actorId: 1, target: admin, otherActiveAdmins: 5 });
    expect(blocked).toMatch(/menghapus akun Anda sendiri/i);
  });

  it("refuses to delete the last active admin", () => {
    const blocked = guardUserDeletion({ actorId: 9, target: admin, otherActiveAdmins: 0 });
    expect(blocked).toMatch(/satu-satunya Super Admin aktif/i);
  });

  it("allows deleting an operator", () => {
    expect(guardUserDeletion({ actorId: 1, target: operator, otherActiveAdmins: 0 })).toBeNull();
  });

  it("allows deleting an admin while another active admin remains", () => {
    expect(guardUserDeletion({ actorId: 9, target: admin, otherActiveAdmins: 1 })).toBeNull();
  });
});

describe("default language of an account", () => {
  const base = {
    username: "operator.zh",
    fullName: "Operator",
    email: "",
    password: "rahasia-123",
    role: "operator" as const,
    plant: "Acid Plant" as const,
    isActive: true,
  };

  it("defaults to Indonesian when the caller does not send one", () => {
    expect(createUserSchema.parse(base).defaultLanguage).toBe("id");
    expect(
      updateUserSchema.parse({ ...base, id: 3, username: undefined, password: undefined })
        .defaultLanguage,
    ).toBe("id");
  });

  it("accepts the three interface languages and nothing else", () => {
    for (const language of ["id", "en", "zh"]) {
      expect(createUserSchema.parse({ ...base, defaultLanguage: language }).defaultLanguage).toBe(
        language,
      );
    }
    expect(createUserSchema.safeParse({ ...base, defaultLanguage: "fr" }).success).toBe(false);
  });
});

describe("describeUserChange", () => {
  const before = {
    fullName: "Operator",
    email: null,
    role: "operator",
    plant: "Acid Plant",
    defaultLanguage: "id",
    isActive: true,
  };
  const label = (value: string) => value.toUpperCase();

  it("records a changed default language with readable names", () => {
    expect(
      describeUserChange(before, { ...before, defaultLanguage: "zh" }, label, label, (language) =>
        language === "zh" ? "中文" : "Indonesia",
      ),
    ).toBe("bahasa: Indonesia -> 中文");
  });

  it("stays silent when the language is unchanged or not stored yet", () => {
    expect(describeUserChange(before, { ...before }, label)).toBeNull();
    // Sebelum kolomnya ada, nilainya kosong di database dan "id" di form.
    expect(
      describeUserChange({ ...before, defaultLanguage: null }, { ...before }, label),
    ).toBeNull();
  });
});
