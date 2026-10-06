// Default import statis, sama seperti carddb.ts. `await import("mssql")` di
// dalam handler menghasilkan namespace ESM yang tidak mengekspos NVarChar/BigInt
// sebagai named export, sehingga sql.NVarChar(...) meledak dengan "is not a
// function". Berkas ini sendiri sudah server-only (hanya di-import dinamis dari
// serverFn), jadi mssql tetap tidak pernah ikut ke bundle client.
import sql from "mssql";

import type { SessionUser } from "../auth";
import { DEFAULT_LANGUAGE, isLanguage, type Language } from "../i18n";

export type AppUserRecord = {
  user: SessionUser;
  passwordHash: string;
  isActive: boolean;
  /** Bahasa default akun; null kalau kolomnya belum ada di database. */
  defaultLanguage: Language | null;
};

// --- Kolom default_language ---------------------------------------------------
// Kolom ini ditambahkan lewat db/mssql/add_app_users_default_language.sql, dan
// skrip itu dijalankan orang, bukan oleh deploy. Supaya versi aplikasi ini
// tetap bisa dipakai login sebelum skripnya dijalankan, keberadaan kolomnya
// diperiksa dulu dan setiap query disusun menurut jawabannya.
//
// Jawaban "ada" disimpan selamanya (kolom tidak menghilang). Jawaban "belum
// ada" hanya disimpan sebentar, supaya aplikasi mengenali kolomnya tidak lama
// setelah skrip dijalankan tanpa perlu di-restart.
const COLUMN_RECHECK_MS = 60_000;
let languageColumn: { present: boolean; checkedAt: number } | null = null;

type DbHandle = Awaited<ReturnType<typeof db>>;

async function hasLanguageColumn({ pool, schema }: DbHandle): Promise<boolean> {
  if (
    languageColumn &&
    (languageColumn.present || Date.now() - languageColumn.checkedAt < COLUMN_RECHECK_MS)
  ) {
    return languageColumn.present;
  }
  const result = await pool
    .request()
    .input("table", sql.NVarChar(300), `${schema}.app_users`)
    .query("SELECT COL_LENGTH(@table, N'default_language') AS panjang;");
  const present = result.recordset[0]?.panjang != null;
  languageColumn = { present, checkedAt: Date.now() };
  return present;
}

/** Hanya untuk test: buang jawaban yang tersimpan. */
export function resetLanguageColumnCache(): void {
  languageColumn = null;
}

function toLanguage(value: unknown): Language | null {
  return isLanguage(value) ? value : null;
}

/**
 * Dilempar saat bahasa selain bawaan diminta padahal kolomnya belum ada.
 * Menyimpan akunnya tanpa bahasa itu akan terlihat berhasil, lalu diam-diam
 * tidak berlaku -- lebih baik ditolak dengan sebab yang jelas.
 */
export class LanguageColumnMissingError extends Error {
  constructor() {
    super(
      "Kolom bahasa belum ada di database. Jalankan db/mssql/add_app_users_default_language.sql (npm run db:migrate), lalu simpan lagi.",
    );
    this.name = "LanguageColumnMissingError";
  }
}

function mapUserRow(row: Record<string, unknown>): AppUserRecord {
  const email = typeof row.email === "string" && row.email !== "" ? row.email : null;
  return {
    user: {
      id: Number(row.id),
      username: String(row.username ?? ""),
      fullName: String(row.full_name ?? row.username ?? ""),
      email,
      role: String(row.role ?? "operator"),
    },
    passwordHash: String(row.password_hash ?? ""),
    isActive: Boolean(row.is_active),
    defaultLanguage: toLanguage(row.default_language),
  };
}

/**
 * Operator boleh mengetik username atau email di kolom yang sama -- keduanya
 * unik di tabel, jadi satu query menutup dua kebiasaan tanpa memaksa mereka
 * hafal yang mana.
 */
export async function findUserForLogin(identifier: string): Promise<AppUserRecord | null> {
  const handle = await db();
  const { pool, schema } = handle;
  const languageSelect = (await hasLanguageColumn(handle))
    ? "u.default_language"
    : "NULL AS default_language";
  const result = await pool.request().input("identifier", sql.NVarChar(200), identifier).query(`
      SELECT TOP 1
        u.id,
        u.username,
        u.full_name,
        u.email,
        u.role,
        u.password_hash,
        u.is_active,
        ${languageSelect}
      FROM ${schema}.app_users u
      WHERE u.username = @identifier
         OR u.email = @identifier;
    `);

  const row = result.recordset[0];
  return row ? mapUserRow(row as Record<string, unknown>) : null;
}

/**
 * Dipanggil setelah password terverifikasi. Kegagalannya sengaja ditelan di
 * pemanggil: gagal mencatat jam login bukan alasan menolak operator masuk.
 */
export async function markUserLogin(userId: number): Promise<void> {
  const { getCardDbPool, getCardDbSchema } = await import("../carddb");

  const schema = `[${getCardDbSchema()}]`;
  const pool = await getCardDbPool();
  await pool.request().input("id", sql.BigInt, userId).query(`
      UPDATE ${schema}.app_users
      SET last_login_at = SYSUTCDATETIME(),
          updated_at = SYSUTCDATETIME()
      WHERE id = @id;
    `);
}

// --- Administrasi akun -------------------------------------------------------
// Dipakai halaman Users. Semua fungsi di bawah mengandaikan pemanggilnya sudah
// memastikan sesi yang meminta berperan admin -- pemeriksaan itu ada di
// user-admin.ts, bukan di sini.

export type AppUserRow = {
  id: number;
  username: string;
  fullName: string;
  email: string | null;
  role: string;
  plant: string;
  /** Bahasa default akun; null kalau kolomnya belum ada di database. */
  defaultLanguage: Language | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function toIso(value: unknown): string | null {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function mapAdminRow(row: Record<string, unknown>): AppUserRow {
  return {
    id: Number(row.id),
    username: String(row.username ?? ""),
    fullName: String(row.full_name ?? ""),
    email: typeof row.email === "string" && row.email !== "" ? row.email : null,
    role: String(row.role ?? "operator"),
    plant: String(row.plant ?? "ALL"),
    defaultLanguage: toLanguage(row.default_language),
    isActive: Boolean(row.is_active),
    lastLoginAt: toIso(row.last_login_at),
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
    updatedAt: toIso(row.updated_at) ?? new Date().toISOString(),
  };
}

const BASE_USER_COLUMNS = `
  u.id, u.username, u.full_name, u.email, u.role, u.plant,
  u.is_active, u.last_login_at, u.created_at, u.updated_at
`;

/** Daftar kolom untuk SELECT (awalan `u.`) atau OUTPUT (awalan `inserted.`). */
function userColumns(withLanguage: boolean, prefix: "u." | "inserted." = "u."): string {
  const columns = withLanguage
    ? `${BASE_USER_COLUMNS.trimEnd()}, u.default_language`
    : BASE_USER_COLUMNS;
  return prefix === "u." ? columns : columns.replace(/u\./g, prefix);
}

async function db() {
  const { getCardDbPool, getCardDbSchema } = await import("../carddb");
  return { pool: await getCardDbPool(), schema: `[${getCardDbSchema()}]` };
}

export async function listUsers(): Promise<AppUserRow[]> {
  const handle = await db();
  const { pool, schema } = handle;
  const result = await pool.request().query(`
    SELECT ${userColumns(await hasLanguageColumn(handle))}
    FROM ${schema}.app_users u
    ORDER BY u.is_active DESC, u.username ASC;
  `);
  return result.recordset.map((row) => mapAdminRow(row as Record<string, unknown>));
}

export async function findUserById(id: number): Promise<AppUserRow | null> {
  const handle = await db();
  const { pool, schema } = handle;
  const columns = userColumns(await hasLanguageColumn(handle));
  const result = await pool.request().input("id", sql.BigInt, id).query(`
    SELECT TOP 1 ${columns} FROM ${schema}.app_users u WHERE u.id = @id;
  `);
  const row = result.recordset[0];
  return row ? mapAdminRow(row as Record<string, unknown>) : null;
}

/**
 * Jumlah admin aktif SELAIN id yang diberikan. Dipakai untuk menolak perubahan
 * yang akan menyisakan sistem tanpa satu pun admin yang bisa masuk.
 */
export async function countOtherActiveAdmins(excludeId: number): Promise<number> {
  const { pool, schema } = await db();
  const result = await pool.request().input("id", sql.BigInt, excludeId).query(`
    SELECT COUNT(*) AS jumlah
    FROM ${schema}.app_users
    WHERE role = N'admin' AND is_active = 1 AND id <> @id;
  `);
  return Number(result.recordset[0]?.jumlah ?? 0);
}

export async function usernameExists(username: string): Promise<boolean> {
  const { pool, schema } = await db();
  const result = await pool.request().input("username", sql.NVarChar(100), username).query(`
    SELECT TOP 1 1 AS ada FROM ${schema}.app_users WHERE username = @username;
  `);
  return result.recordset.length > 0;
}

export async function emailExists(email: string, excludeId?: number): Promise<boolean> {
  const { pool, schema } = await db();
  const result = await pool
    .request()
    .input("email", sql.NVarChar(200), email)
    .input("excludeId", sql.BigInt, excludeId ?? -1).query(`
      SELECT TOP 1 1 AS ada
      FROM ${schema}.app_users
      WHERE email = @email AND id <> @excludeId;
    `);
  return result.recordset.length > 0;
}

export async function insertUser(input: {
  username: string;
  fullName: string;
  email: string | null;
  passwordHash: string;
  role: string;
  plant: string;
  defaultLanguage: Language;
  isActive: boolean;
}): Promise<AppUserRow> {
  const handle = await db();
  const { pool, schema } = handle;
  const withLanguage = await hasLanguageColumn(handle);
  // Tanpa kolomnya, bahasa bawaan tetap boleh: itulah yang akan berlaku juga.
  if (!withLanguage && input.defaultLanguage !== DEFAULT_LANGUAGE) {
    throw new LanguageColumnMissingError();
  }
  const result = await pool
    .request()
    .input("username", sql.NVarChar(100), input.username)
    .input("fullName", sql.NVarChar(200), input.fullName)
    .input("email", sql.NVarChar(200), input.email)
    .input("passwordHash", sql.NVarChar(400), input.passwordHash)
    .input("role", sql.NVarChar(50), input.role)
    .input("plant", sql.NVarChar(100), input.plant)
    .input("defaultLanguage", sql.NVarChar(10), input.defaultLanguage)
    .input("isActive", sql.Bit, input.isActive ? 1 : 0).query(`
      INSERT INTO ${schema}.app_users
        (username, full_name, email, password_hash, role, plant, is_active${withLanguage ? ", default_language" : ""})
      OUTPUT ${userColumns(withLanguage, "inserted.")}
      VALUES (@username, @fullName, @email, @passwordHash, @role, @plant, @isActive${withLanguage ? ", @defaultLanguage" : ""});
    `);
  return mapAdminRow(result.recordset[0] as Record<string, unknown>);
}

export async function updateUserProfile(input: {
  id: number;
  fullName: string;
  email: string | null;
  role: string;
  plant: string;
  defaultLanguage: Language;
  isActive: boolean;
}): Promise<AppUserRow | null> {
  const handle = await db();
  const { pool, schema } = handle;
  const withLanguage = await hasLanguageColumn(handle);
  if (!withLanguage && input.defaultLanguage !== DEFAULT_LANGUAGE) {
    throw new LanguageColumnMissingError();
  }
  const result = await pool
    .request()
    .input("id", sql.BigInt, input.id)
    .input("fullName", sql.NVarChar(200), input.fullName)
    .input("email", sql.NVarChar(200), input.email)
    .input("role", sql.NVarChar(50), input.role)
    .input("plant", sql.NVarChar(100), input.plant)
    .input("defaultLanguage", sql.NVarChar(10), input.defaultLanguage)
    .input("isActive", sql.Bit, input.isActive ? 1 : 0).query(`
      UPDATE ${schema}.app_users
      SET full_name = @fullName,
          email = @email,
          role = @role,
          plant = @plant,
          is_active = @isActive,${withLanguage ? "\n          default_language = @defaultLanguage," : ""}
          updated_at = SYSUTCDATETIME()
      OUTPUT ${userColumns(withLanguage, "inserted.")}
      WHERE id = @id;
    `);
  const row = result.recordset[0];
  return row ? mapAdminRow(row as Record<string, unknown>) : null;
}

export async function updateUserPassword(id: number, passwordHash: string): Promise<boolean> {
  const { pool, schema } = await db();
  const result = await pool
    .request()
    .input("id", sql.BigInt, id)
    .input("passwordHash", sql.NVarChar(400), passwordHash).query(`
      UPDATE ${schema}.app_users
      SET password_hash = @passwordHash, updated_at = SYSUTCDATETIME()
      WHERE id = @id;
    `);
  return (result.rowsAffected[0] ?? 0) > 0;
}

export async function deleteUser(id: number): Promise<boolean> {
  const { pool, schema } = await db();
  const result = await pool.request().input("id", sql.BigInt, id).query(`
    DELETE FROM ${schema}.app_users WHERE id = @id;
  `);
  return (result.rowsAffected[0] ?? 0) > 0;
}
