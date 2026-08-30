import fs from "node:fs/promises";
import path from "node:path";

import sql from "mssql";

const MIGRATIONS = [
  "create_app_users.sql",
  "add_app_users_plant.sql",
  "create_activity_log.sql",
  "create_api_refresh_sessions.sql",
];

const REQUIRED_ENV = ["CARDDB_USER", "CARDDB_PASSWORD", "CARDDB_SERVER", "CARDDB_NAME"];

function dbConfig() {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing DB env: ${missing.join(", ")}`);
  }

  return {
    user: process.env.CARDDB_USER,
    password: process.env.CARDDB_PASSWORD,
    server: process.env.CARDDB_SERVER,
    database: process.env.CARDDB_NAME,
    port: Number(process.env.CARDDB_PORT || 1433),
    options: {
      encrypt: false,
      trustServerCertificate: true,
    },
    pool: {
      max: 3,
      min: 0,
      idleTimeoutMillis: 30_000,
    },
  };
}

async function run() {
  const cwd = process.cwd();
  const migrationsDir = path.join(cwd, "db", "mssql");
  const pool = await sql.connect(dbConfig());

  try {
    for (const fileName of MIGRATIONS) {
      const absolutePath = path.join(migrationsDir, fileName);
      const script = await fs.readFile(absolutePath, "utf8");

      console.log(`\n==> Running migration: ${fileName}`);
      const result = await pool.request().batch(script);

      const summary = {
        rowsAffected: result.rowsAffected,
        recordsets: result.recordsets?.map((recordset) => recordset.length) ?? [],
      };
      console.log(JSON.stringify(summary, null, 2));
    }

    console.log("\nDB migrations completed.");
  } finally {
    await pool.close();
  }
}

run().catch((error) => {
  console.error("\nDB migration failed.");
  console.error(error);
  process.exit(1);
});
