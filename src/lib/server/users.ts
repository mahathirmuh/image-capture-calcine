// Default import statis, sama seperti carddb.ts. `await import("mssql")` di
// dalam handler menghasilkan namespace ESM yang tidak mengekspos NVarChar/BigInt
// sebagai named export, sehingga sql.NVarChar(...) meledak dengan "is not a
// function". Berkas ini sendiri sudah server-only (hanya di-import dinamis dari
// serverFn), jadi mssql tetap tidak pernah ikut ke bundle client.
import sql from "mssql";

import type { SessionUser } from "../auth";

export type AppUserRecord = {
  user: SessionUser;
  passwordHash: string;
  isActive: boolean;
};

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
  };
}

/**
 * Operator boleh mengetik username atau email di kolom yang sama -- keduanya
 * unik di tabel, jadi satu query menutup dua kebiasaan tanpa memaksa mereka
 * hafal yang mana.
 */
export async function findUserForLogin(identifier: string): Promise<AppUserRecord | null> {
  const { getCardDbPool, getCardDbSchema } = await import("../carddb");

  const schema = `[${getCardDbSchema()}]`;
  const pool = await getCardDbPool();
  const result = await pool.request().input("identifier", sql.NVarChar(200), identifier).query(`
      SELECT TOP 1
        u.id,
        u.username,
        u.full_name,
        u.email,
        u.role,
        u.password_hash,
        u.is_active
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
    isActive: Boolean(row.is_active),
    lastLoginAt: toIso(row.last_login_at),
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
    updatedAt: toIso(row.updated_at) ?? new Date().toISOString(),
  };
}

const USER_COLUMNS = `
  u.id, u.username, u.full_name, u.email, u.role,
  u.is_active, u.last_login_at, u.created_at, u.updated_at
`;

async function db() {
  const { getCardDbPool, getCardDbSchema } = await import("../carddb");
  return { pool: await getCardDbPool(), schema: `[${getCardDbSchema()}]` };
}

export async function listUsers(): Promise<AppUserRow[]> {
  const { pool, schema } = await db();
  const result = await pool.request().query(`
    SELECT ${USER_COLUMNS}
    FROM ${schema}.app_users u
    ORDER BY u.is_active DESC, u.username ASC;
  `);
  return result.recordset.map((row) => mapAdminRow(row as Record<string, unknown>));
}

export async function findUserById(id: number): Promise<AppUserRow | null> {
  const { pool, schema } = await db();
  const result = await pool.request().input("id", sql.BigInt, id).query(`
    SELECT TOP 1 ${USER_COLUMNS} FROM ${schema}.app_users u WHERE u.id = @id;
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
  isActive: boolean;
}): Promise<AppUserRow> {
  const { pool, schema } = await db();
  const result = await pool
    .request()
    .input("username", sql.NVarChar(100), input.username)
    .input("fullName", sql.NVarChar(200), input.fullName)
    .input("email", sql.NVarChar(200), input.email)
    .input("passwordHash", sql.NVarChar(400), input.passwordHash)
    .input("role", sql.NVarChar(50), input.role)
    .input("isActive", sql.Bit, input.isActive ? 1 : 0).query(`
      INSERT INTO ${schema}.app_users
        (username, full_name, email, password_hash, role, is_active)
      OUTPUT ${USER_COLUMNS.replace(/u\./g, "inserted.")}
      VALUES (@username, @fullName, @email, @passwordHash, @role, @isActive);
    `);
  return mapAdminRow(result.recordset[0] as Record<string, unknown>);
}

export async function updateUserProfile(input: {
  id: number;
  fullName: string;
  email: string | null;
  role: string;
  isActive: boolean;
}): Promise<AppUserRow | null> {
  const { pool, schema } = await db();
  const result = await pool
    .request()
    .input("id", sql.BigInt, input.id)
    .input("fullName", sql.NVarChar(200), input.fullName)
    .input("email", sql.NVarChar(200), input.email)
    .input("role", sql.NVarChar(50), input.role)
    .input("isActive", sql.Bit, input.isActive ? 1 : 0).query(`
      UPDATE ${schema}.app_users
      SET full_name = @fullName,
          email = @email,
          role = @role,
          is_active = @isActive,
          updated_at = SYSUTCDATETIME()
      OUTPUT ${USER_COLUMNS.replace(/u\./g, "inserted.")}
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
