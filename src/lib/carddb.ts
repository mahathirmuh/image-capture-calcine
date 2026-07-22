import sql from "mssql";

import { getServerEnv } from "./env";

export type CardDbConfig = {
  user: string;
  password: string;
  server: string;
  database: string;
  port: number;
  schema: string;
};

let cachedPoolPromise: Promise<sql.ConnectionPool> | null = null;

function isSafeIdentifier(value: string) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(value);
}

export function getCardDbConfig(): CardDbConfig | null {
  const env = getServerEnv();
  if (!env.CARDDB_USER || !env.CARDDB_PASSWORD || !env.CARDDB_SERVER || !env.CARDDB_NAME) {
    return null;
  }

  const schema = env.CARDDB_SCHEMA ?? "dbo";
  if (!isSafeIdentifier(schema)) {
    throw new Error(`CARDDB_SCHEMA tidak valid: ${schema}`);
  }

  return {
    user: env.CARDDB_USER,
    password: env.CARDDB_PASSWORD,
    server: env.CARDDB_SERVER,
    database: env.CARDDB_NAME,
    port: env.CARDDB_PORT ?? 1433,
    schema,
  };
}

export function isCardDbConfigured() {
  return getCardDbConfig() !== null;
}

export function getCardDbSchema() {
  return getCardDbConfig()?.schema ?? "dbo";
}

export async function getCardDbPool() {
  const config = getCardDbConfig();
  if (!config) {
    throw new Error("Konfigurasi CARDDB belum lengkap di environment server.");
  }

  cachedPoolPromise ??= sql.connect({
    user: config.user,
    password: config.password,
    server: config.server,
    database: config.database,
    port: config.port,
    options: {
      encrypt: false,
      trustServerCertificate: true,
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30_000,
    },
  });

  return cachedPoolPromise;
}
