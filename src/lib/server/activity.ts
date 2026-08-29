import sql from "mssql";

import type { ActivityAction, ActivityEntry, ActivitySeverity } from "../activity-log";

export type RecordActivityInput = {
  action: ActivityAction;
  severity?: ActivitySeverity;
  actorId?: number | null;
  actorUsername?: string | null;
  targetId?: number | null;
  targetUsername?: string | null;
  detail?: string | null;
};

/**
 * Identitas pemanggil dari sesi, untuk mengisi kolom pelaku.
 *
 * Tinggal di sini, bersama recordActivity, karena setiap pemanggil butuh
 * keduanya sekaligus -- dan salinan yang tersebar di tiap modul pasti akan
 * berbeda cara menangani sesi yang gagal dibaca.
 *
 * Sumbernya sesi di sisi server, TIDAK pernah payload klien: jejak yang
 * pelakunya bisa disebutkan sendiri oleh pemanggil bukan jejak.
 */
export async function currentActor(): Promise<{ id: number; username: string } | null> {
  try {
    const { getAppSession } = await import("./session");
    const session = await getAppSession();
    const user = session.data.user;
    return user ? { id: user.id, username: user.username } : null;
  } catch {
    return null;
  }
}

async function db() {
  const { getCardDbPool, getCardDbSchema } = await import("../carddb");
  return { pool: await getCardDbPool(), schema: `[${getCardDbSchema()}]` };
}

/**
 * Alamat IP pemanggil, untuk membedakan percobaan login dari mesin plant dan
 * dari luar. Dibungkus try/catch karena di luar konteks permintaan -- misalnya
 * saat dipanggil dari skrip -- helper-nya melempar, dan itu tidak boleh
 * menggagalkan aksi yang sedang dicatat.
 */
async function callerIp(): Promise<string | null> {
  try {
    const { getRequestIP } = await import("@tanstack/react-start/server");
    return getRequestIP({ xForwardedFor: true }) ?? null;
  } catch {
    return null;
  }
}

/**
 * Mencatat satu baris jejak aktivitas.
 *
 * TIDAK PERNAH melempar. Pencatatan adalah pengamat, bukan peserta: kegagalan
 * menulis jejak tidak boleh menggagalkan login atau perubahan akun yang sedang
 * terjadi. Kalau ini melempar, operator yang passwordnya benar bisa ditolak
 * masuk hanya karena tabel log-nya bermasalah.
 */
export async function recordActivity(input: RecordActivityInput): Promise<void> {
  try {
    const { pool, schema } = await db();
    await pool
      .request()
      .input("action", sql.NVarChar(50), input.action)
      .input("severity", sql.NVarChar(20), input.severity ?? "info")
      .input("actorId", sql.BigInt, input.actorId ?? null)
      .input("actorUsername", sql.NVarChar(100), input.actorUsername ?? null)
      .input("targetId", sql.BigInt, input.targetId ?? null)
      .input("targetUsername", sql.NVarChar(100), input.targetUsername ?? null)
      .input("detail", sql.NVarChar(500), input.detail ?? null)
      .input("ip", sql.NVarChar(64), await callerIp()).query(`
        INSERT INTO ${schema}.activity_log
          (action, severity, actor_id, actor_username, target_id, target_username, detail, ip_address)
        VALUES
          (@action, @severity, @actorId, @actorUsername, @targetId, @targetUsername, @detail, @ip);
      `);
  } catch {
    // Sengaja ditelan -- lihat komentar di atas.
  }
}

function toIso(value: unknown): string {
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function mapRow(row: Record<string, unknown>): ActivityEntry {
  const teks = (nilai: unknown) => (typeof nilai === "string" && nilai !== "" ? nilai : null);

  return {
    id: Number(row.id),
    occurredAt: toIso(row.occurred_at),
    action: String(row.action) as ActivityAction,
    severity: (String(row.severity) === "warning" ? "warning" : "info") as ActivitySeverity,
    actorUsername: teks(row.actor_username),
    targetUsername: teks(row.target_username),
    detail: teks(row.detail),
    ipAddress: teks(row.ip_address),
  };
}

export async function listActivity(input: {
  action: string | null;
  search: string | null;
  limit: number;
}): Promise<{ entries: ActivityEntry[]; total: number }> {
  const { pool, schema } = await db();

  // Dua penyaring digabung sebagai parameter, bukan dirangkai ke dalam SQL:
  // isian pencarian datang dari kolom bebas di halaman Log.
  const where = `
    WHERE (@action IS NULL OR a.action = @action)
      AND (
        @search IS NULL
        OR a.actor_username LIKE @search
        OR a.target_username LIKE @search
        OR a.detail LIKE @search
        OR a.ip_address LIKE @search
      )
  `;

  const request = pool
    .request()
    .input("action", sql.NVarChar(50), input.action)
    .input("search", sql.NVarChar(200), input.search ? `%${input.search}%` : null)
    .input("limit", sql.Int, input.limit);

  const [rows, count] = await Promise.all([
    request.query(`
      SELECT TOP (@limit)
        a.id, a.occurred_at, a.action, a.severity,
        a.actor_username, a.target_username, a.detail, a.ip_address
      FROM ${schema}.activity_log a
      ${where}
      ORDER BY a.occurred_at DESC, a.id DESC;
    `),
    pool
      .request()
      .input("action", sql.NVarChar(50), input.action)
      .input("search", sql.NVarChar(200), input.search ? `%${input.search}%` : null).query(`
        SELECT COUNT(*) AS total FROM ${schema}.activity_log a ${where};
      `),
  ]);

  return {
    entries: rows.recordset.map((row) => mapRow(row as Record<string, unknown>)),
    total: Number(count.recordset[0]?.total ?? 0),
  };
}
