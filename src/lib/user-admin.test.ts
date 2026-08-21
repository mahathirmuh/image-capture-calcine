import { describe, expect, it } from "vitest";

import { guardUserDeletion, guardUserUpdate } from "./user-admin";

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

    expect(blocked).toMatch(/melepas peran admin dari akun Anda sendiri/i);
  });

  it("refuses to demote the last active admin, even by another admin", () => {
    const blocked = guardUserUpdate({
      actorId: 9,
      target: admin,
      next: { role: "operator", isActive: true },
      otherActiveAdmins: 0,
    });

    expect(blocked).toMatch(/satu-satunya admin aktif/i);
  });

  it("refuses to deactivate the last active admin", () => {
    const blocked = guardUserUpdate({
      actorId: 9,
      target: admin,
      next: { role: "admin", isActive: false },
      otherActiveAdmins: 0,
    });

    expect(blocked).toMatch(/satu-satunya admin aktif/i);
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
    expect(blocked).toMatch(/satu-satunya admin aktif/i);
  });

  it("allows deleting an operator", () => {
    expect(guardUserDeletion({ actorId: 1, target: operator, otherActiveAdmins: 0 })).toBeNull();
  });

  it("allows deleting an admin while another active admin remains", () => {
    expect(guardUserDeletion({ actorId: 9, target: admin, otherActiveAdmins: 1 })).toBeNull();
  });
});
