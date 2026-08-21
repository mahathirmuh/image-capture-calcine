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
