import { beforeEach, describe, expect, it, vi } from "vitest";

// Database tiruan: mencatat setiap SQL yang dikirim dan menjawab menurut
// apakah kolom default_language "sudah ada".
const state = vi.hoisted(() => ({
  columnPresent: false,
  queries: [] as string[],
  row: {} as Record<string, unknown>,
}));

vi.mock("../carddb", () => {
  const request = () => ({
    input() {
      return this;
    },
    async query(text: string) {
      state.queries.push(text);
      if (text.includes("COL_LENGTH")) {
        return { recordset: [{ panjang: state.columnPresent ? 20 : null }], rowsAffected: [1] };
      }
      return { recordset: [state.row], rowsAffected: [1] };
    },
  });
  return {
    getCardDbPool: async () => ({ request }),
    getCardDbSchema: () => "dbo",
  };
});

import {
  LanguageColumnMissingError,
  findUserById,
  findUserForLogin,
  insertUser,
  resetLanguageColumnCache,
  updateUserProfile,
} from "./users";

const baseRow = {
  id: 7,
  username: "operator.zh",
  full_name: "Operator",
  email: null,
  role: "operator",
  plant: "Acid Plant",
  password_hash: "x",
  is_active: true,
};

const newUser = {
  username: "operator.zh",
  fullName: "Operator",
  email: null,
  passwordHash: "x",
  role: "operator",
  plant: "Acid Plant",
  isActive: true,
};

const lastQuery = () => state.queries[state.queries.length - 1];

beforeEach(() => {
  resetLanguageColumnCache();
  state.queries.length = 0;
  state.columnPresent = false;
  state.row = { ...baseRow };
});

describe("before the default_language column exists", () => {
  it("still finds accounts for login, with no language", async () => {
    const record = await findUserForLogin("operator.zh");
    expect(lastQuery()).toContain("NULL AS default_language");
    expect(lastQuery()).not.toContain("u.default_language");
    expect(record?.defaultLanguage).toBeNull();
  });

  it("reads accounts without touching the missing column", async () => {
    const user = await findUserById(7);
    expect(lastQuery()).not.toContain("default_language");
    expect(user?.defaultLanguage).toBeNull();
  });

  it("creates and updates an account that keeps the built-in language", async () => {
    await insertUser({ ...newUser, defaultLanguage: "id" });
    expect(lastQuery()).not.toContain("default_language");
    await updateUserProfile({ ...newUser, id: 7, defaultLanguage: "id" });
    expect(lastQuery()).not.toContain("default_language");
  });

  it("refuses another language instead of silently dropping it", async () => {
    await expect(insertUser({ ...newUser, defaultLanguage: "zh" })).rejects.toBeInstanceOf(
      LanguageColumnMissingError,
    );
    await expect(
      updateUserProfile({ ...newUser, id: 7, defaultLanguage: "en" }),
    ).rejects.toBeInstanceOf(LanguageColumnMissingError);
    // Tidak ada INSERT atau UPDATE yang sempat terkirim.
    expect(state.queries.every((text) => text.includes("COL_LENGTH"))).toBe(true);
  });

  it("asks the database again later, but not on every call", async () => {
    await findUserById(7);
    await findUserById(7);
    expect(state.queries.filter((text) => text.includes("COL_LENGTH"))).toHaveLength(1);
  });
});

describe("once the default_language column exists", () => {
  beforeEach(() => {
    state.columnPresent = true;
    state.row = { ...baseRow, default_language: "zh" };
  });

  it("returns the account language at login", async () => {
    const record = await findUserForLogin("operator.zh");
    expect(lastQuery()).toContain("u.default_language");
    expect(record?.defaultLanguage).toBe("zh");
  });

  it("stores the chosen language on create and update", async () => {
    const created = await insertUser({ ...newUser, defaultLanguage: "zh" });
    expect(lastQuery()).toContain("is_active, default_language)");
    expect(lastQuery()).toContain("@isActive, @defaultLanguage)");
    expect(lastQuery()).toContain("inserted.default_language");
    expect(created.defaultLanguage).toBe("zh");

    const updated = await updateUserProfile({ ...newUser, id: 7, defaultLanguage: "zh" });
    expect(lastQuery()).toContain("default_language = @defaultLanguage,");
    expect(updated?.defaultLanguage).toBe("zh");
  });

  it("treats an unknown stored value as no language rather than trusting it", async () => {
    state.row = { ...baseRow, default_language: "fr" };
    expect((await findUserById(7))?.defaultLanguage).toBeNull();
  });

  it("remembers that the column exists", async () => {
    await findUserById(7);
    await findUserById(7);
    await findUserById(7);
    expect(state.queries.filter((text) => text.includes("COL_LENGTH"))).toHaveLength(1);
  });
});
