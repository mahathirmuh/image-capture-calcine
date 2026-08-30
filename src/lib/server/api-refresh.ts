import { createHash, randomBytes } from "node:crypto";

import sql from "mssql";

import { getCardDbPool, getCardDbSchema } from "../carddb";

export const API_REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60_000;

type RefreshSessionRow = {
  id: number;
  userId: number;
  expiresAt: number;
  revokedAt: number | null;
};

type RefreshSessionCheck =
  | { ok: true; session: RefreshSessionRow }
  | { ok: false; code: "INVALID" | "EXPIRED" | "REVOKED" };

function tableName(): string {
  return `[${getCardDbSchema()}].app_api_refresh_sessions`;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

function randomToken(): string {
  return randomBytes(48).toString("base64url");
}

function toMillis(value: unknown): number | null {
  if (!value) return null;
  const parsed = new Date(String(value)).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

async function findSessionByToken(token: string): Promise<RefreshSessionRow | null> {
  const pool = await getCardDbPool();
  const result = await pool
    .request()
    .input("tokenHash", sql.NVarChar(128), hashToken(token))
    .query(`
      SELECT TOP 1 id, user_id, expires_at, revoked_at
      FROM ${tableName()}
      WHERE token_hash = @tokenHash;
    `);

  const row = result.recordset[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    expiresAt: toMillis(row.expires_at) ?? 0,
    revokedAt: toMillis(row.revoked_at),
  };
}

export async function createRefreshSession(userId: number, now = Date.now()) {
  const token = randomToken();
  const expiresAt = new Date(now + API_REFRESH_TOKEN_TTL_MS);
  const pool = await getCardDbPool();
  await pool
    .request()
    .input("userId", sql.BigInt, userId)
    .input("tokenHash", sql.NVarChar(128), hashToken(token))
    .input("expiresAt", sql.DateTime2, expiresAt)
    .query(`
      INSERT INTO ${tableName()} (user_id, token_hash, expires_at)
      VALUES (@userId, @tokenHash, @expiresAt);
    `);

  return { token, expiresAt: expiresAt.toISOString() };
}

export async function verifyRefreshSession(
  token: string,
  now = Date.now(),
): Promise<RefreshSessionCheck> {
  const session = await findSessionByToken(token);
  if (!session) return { ok: false, code: "INVALID" };
  if (session.revokedAt !== null) return { ok: false, code: "REVOKED" };
  if (now > session.expiresAt) return { ok: false, code: "EXPIRED" };
  return { ok: true, session };
}

export async function rotateRefreshSession(token: string, now = Date.now()) {
  const check = await verifyRefreshSession(token, now);
  if (!check.ok) return check;

  const nextToken = randomToken();
  const nextExpiresAt = new Date(now + API_REFRESH_TOKEN_TTL_MS);
  const pool = await getCardDbPool();
  await pool
    .request()
    .input("id", sql.BigInt, check.session.id)
    .input("tokenHash", sql.NVarChar(128), hashToken(nextToken))
    .input("expiresAt", sql.DateTime2, nextExpiresAt)
    .query(`
      UPDATE ${tableName()}
      SET token_hash = @tokenHash,
          expires_at = @expiresAt,
          last_used_at = SYSUTCDATETIME(),
          updated_at = SYSUTCDATETIME()
      WHERE id = @id;
    `);

  return {
    ok: true as const,
    session: check.session,
    token: nextToken,
    expiresAt: nextExpiresAt.toISOString(),
  };
}

export async function revokeRefreshSession(token: string): Promise<void> {
  const pool = await getCardDbPool();
  await pool
    .request()
    .input("tokenHash", sql.NVarChar(128), hashToken(token))
    .query(`
      UPDATE ${tableName()}
      SET revoked_at = COALESCE(revoked_at, SYSUTCDATETIME()),
          updated_at = SYSUTCDATETIME()
      WHERE token_hash = @tokenHash;
    `);
}
