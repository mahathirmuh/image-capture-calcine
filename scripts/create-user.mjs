// Tambah atau reset akun login aplikasi.
//
//   node --env-file=.env scripts/create-user.mjs <username> <password> [opsi]
//
// Opsi:
//   --name  "Nama Lengkap"   nama yang tampil di sidebar (default: username)
//   --email nama@mbma.co.id  alamat email, boleh dipakai untuk login
//   --role  admin|operator   default: operator
//   --plant "Acid Plant"     penempatan plant; default ALL (semua plant)
//   --inactive               buat/tandai akun sebagai nonaktif
//
// Username yang sudah ada akan diperbarui, bukan digandakan -- jadi perintah
// yang sama juga berfungsi sebagai reset password.
//
// Hashing sengaja mengimpor modul aplikasi (src/lib/server/password.ts) alih-alih
// menyalin ulang scrypt-nya: satu-satunya cara memastikan hash yang ditulis di
// sini persis yang diharapkan halaman login. Node 24 menjalankan berkas .ts itu
// langsung lewat type stripping bawaannya.

import process from "node:process";

import sql from "mssql";

import { hashPassword } from "../src/lib/server/password.ts";

const FLAGS_WITH_VALUE = new Set(["--name", "--email", "--role", "--plant"]);

function parseArgs(argv) {
  const positional = [];
  const options = { inactive: false };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--inactive") {
      options.inactive = true;
      continue;
    }

    if (FLAGS_WITH_VALUE.has(arg)) {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new Error(`Opsi ${arg} butuh nilai.`);
      }
      options[arg.slice(2)] = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--")) {
      throw new Error(`Opsi tidak dikenal: ${arg}`);
    }

    positional.push(arg);
  }

  return { positional, options };
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `${name} kosong. Jalankan dengan \`node --env-file=.env scripts/create-user.mjs ...\` dari root proyek.`,
    );
  }
  return value;
}

function isSafeIdentifier(value) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(value);
}

async function main() {
  const { positional, options } = parseArgs(process.argv.slice(2));
  const [username, password] = positional;

  if (!username || !password) {
    throw new Error(
      'Pemakaian: node --env-file=.env scripts/create-user.mjs <username> <password> [--name "Nama Lengkap"] [--email a@b.c] [--role admin] [--inactive]',
    );
  }

  if (password.length < 8) {
    throw new Error("Password minimal 8 karakter.");
  }

  const schema = process.env.CARDDB_SCHEMA?.trim() || "dbo";
  if (!isSafeIdentifier(schema)) {
    throw new Error(`CARDDB_SCHEMA tidak valid: ${schema}`);
  }

  const passwordHash = await hashPassword(password);

  const pool = await sql.connect({
    user: requireEnv("CARDDB_USER"),
    password: requireEnv("CARDDB_PASSWORD"),
    server: requireEnv("CARDDB_SERVER"),
    database: requireEnv("CARDDB_NAME"),
    port: Number(process.env.CARDDB_PORT ?? 1433),
    options: { encrypt: false, trustServerCertificate: true },
  });

  try {
    const result = await pool
      .request()
      .input("username", sql.NVarChar(100), username)
      .input("fullName", sql.NVarChar(200), options.name ?? username)
      .input("email", sql.NVarChar(200), options.email ?? null)
      .input("passwordHash", sql.NVarChar(400), passwordHash)
      .input("role", sql.NVarChar(50), options.role ?? "operator")
      .input("plant", sql.NVarChar(100), options.plant ?? "ALL")
      .input("isActive", sql.Bit, options.inactive ? 0 : 1).query(`
        MERGE [${schema}].app_users AS target
        USING (SELECT @username AS username) AS source
          ON target.username = source.username
        WHEN MATCHED THEN
          UPDATE SET
            full_name = @fullName,
            email = @email,
            password_hash = @passwordHash,
            role = @role,
            plant = @plant,
            is_active = @isActive,
            updated_at = SYSUTCDATETIME()
        WHEN NOT MATCHED THEN
          INSERT (username, full_name, email, password_hash, role, plant, is_active)
          VALUES (@username, @fullName, @email, @passwordHash, @role, @plant, @isActive)
        OUTPUT $action AS action, inserted.id AS id;
      `);

    const row = result.recordset[0];
    const verb = row?.action === "INSERT" ? "dibuat" : "diperbarui";
    console.log(`Akun "${username}" ${verb} (id ${row?.id}).`);
    console.log(
      `Role: ${options.role ?? "operator"} | Aktif: ${options.inactive ? "tidak" : "ya"}`,
    );
  } finally {
    await pool.close();
  }
}

main().catch((error) => {
  console.error(`Gagal: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
