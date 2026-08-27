// REST API baca-saja di /api/v1, untuk sistem lain (monitoring, LIMS,
// dasbor pelaporan) -- bukan untuk halaman aplikasi ini sendiri, yang memakai
// serverFn.
//
// Dipasang di src/server.ts, sebelum permintaan diserahkan ke TanStack Start.
// Bukan sebagai file route: route TanStack ikut membawa router, SSR, dan
// middleware CSRF yang seluruhnya tidak berlaku untuk konsumen mesin-ke-mesin.
// Di sini permukaannya tetap kecil, eksplisit, dan cocok satu-satu dengan
// docs/openapi.yaml.
//
// BACA-SAJA, tanpa kecuali. Tidak ada endpoint yang menulis ke registry, ke
// antrean, maupun ke folder jaringan.
import sql from "mssql";

// Spesifikasinya diimpor sebagai teks, bukan dibaca dari disk saat runtime:
// dengan begini isinya ikut masuk ke bundel server, jadi tidak ada berkas yang
// bisa tertinggal saat image Docker dibangun -- dan halaman dokumentasi tidak
// mungkin menggambarkan versi yang berbeda dari yang ada di repo.
import openapiSpec from "../../../docs/openapi.yaml?raw";
import { getCardDbPool, getCardDbSchema, isCardDbConfigured } from "../carddb";
import { mapCaptureRecordRow, type CaptureRecordView } from "../capture-records";
import { CAPTURE_SESSION_HOURS, formatSessionLabel } from "../capture-session";
import { getServerEnv } from "../env";
import { BIN_SLOTS, PLANTS, toBinLabel, toBinTitle, toLocationToken } from "../locations";
import { buildSessionCoverage, toLocalDateKey, type CoverageRecord } from "../session-coverage";
import { API_KEY_HEADER, authenticateApiRequest, isApiEnabled } from "./api-auth";
import { renderApiDocsPage } from "./api-docs-page";

export const API_PREFIX = "/api/v1";

/** Batas atas satu halaman. Tanpa batas, satu permintaan bisa menarik seluruh
 * tabel dan membuat registry terasa mati bagi halaman aplikasi. */
const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 50;

/** Berapa lama health boleh menunggu satu pemeriksaan sebelum menyerah.
 * Monitoring yang menunggu selamanya tidak melaporkan apa pun. */
const HEALTH_CHECK_TIMEOUT_MS = 5_000;

export function isApiRequest(pathname: string): boolean {
  return pathname === API_PREFIX || pathname.startsWith(`${API_PREFIX}/`);
}

function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      // Jawaban ini menggambarkan keadaan yang berubah terus; proxy yang
      // menyimpannya akan membuat monitoring melihat masa lalu.
      "cache-control": "no-store",
      ...extraHeaders,
    },
  });
}

function apiError(status: number, code: string, message: string): Response {
  return json({ error: { code, message } }, status);
}

async function withTimeout<T>(work: Promise<T>, ms: number, onTimeout: () => T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(onTimeout()), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

// --- parsing parameter --------------------------------------------------------

function parseLimit(raw: string | null): number | { error: string } {
  if (raw === null) return DEFAULT_LIMIT;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) return { error: "limit harus bilangan bulat >= 1" };
  return Math.min(value, MAX_LIMIT);
}

function parseOffset(raw: string | null): number | { error: string } {
  if (raw === null) return 0;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) return { error: "offset harus bilangan bulat >= 0" };
  return value;
}

const BARE_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Batas rentang waktu.
 *
 * Tanggal telanjang ("2026-08-27") dibaca sebagai HARI UTC, sama seperti cara
 * `captured_at` disimpan. Untuk `to`, tanggal telanjang digeser ke awal hari
 * berikutnya supaya `from=X&to=X` berarti "sepanjang hari X" -- batas atas yang
 * eksklusif tapi terbaca inklusif, yang memang yang diharapkan orang.
 */
function parseRangeBound(
  raw: string | null,
  bound: "from" | "to",
): Date | null | { error: string } {
  if (raw === null || raw.trim() === "") return null;
  const value = raw.trim();
  const parsed = new Date(BARE_DATE.test(value) ? `${value}T00:00:00.000Z` : value);
  if (Number.isNaN(parsed.getTime())) {
    return { error: `${bound} bukan tanggal/waktu yang sah: ${value}` };
  }
  if (bound === "to" && BARE_DATE.test(value)) {
    return new Date(parsed.getTime() + 24 * 60 * 60 * 1000);
  }
  return parsed;
}

function isParamError(value: unknown): value is { error: string } {
  return typeof value === "object" && value !== null && "error" in value;
}

// --- GET /api/v1/health -------------------------------------------------------

type HealthCheck = { ok: boolean; [key: string]: unknown };

async function checkNetworkShare(): Promise<HealthCheck> {
  const targetRoot = getServerEnv().NETWORK_SAVE_ROOT ?? null;
  if (!targetRoot) {
    return { ok: false, configured: false, targetRoot: null, code: "NOT_CONFIGURED" };
  }

  // Sengaja stat + access, BUKAN tulis-hapus seperti probe di halaman Storage.
  // Monitoring memanggil endpoint ini tiap menit; menulis berkas percobaan
  // sesering itu ke share produksi menambah beban tanpa menambah kepastian.
  return withTimeout(
    (async (): Promise<HealthCheck> => {
      try {
        const [{ access, stat }, { constants }] = await Promise.all([
          import("node:fs/promises"),
          import("node:fs"),
        ]);
        const info = await stat(targetRoot);
        if (!info.isDirectory()) {
          return { ok: false, configured: true, targetRoot, code: "NOT_DIRECTORY" };
        }
        await access(targetRoot, constants.R_OK | constants.W_OK);
        return { ok: true, configured: true, targetRoot, code: null };
      } catch (error: unknown) {
        const code =
          typeof error === "object" && error !== null && "code" in error
            ? String((error as { code: unknown }).code)
            : "UNKNOWN";
        return {
          ok: false,
          configured: true,
          targetRoot,
          code,
          message: errorMessage(error, "Gagal memeriksa folder jaringan."),
        };
      }
    })(),
    HEALTH_CHECK_TIMEOUT_MS,
    () => ({ ok: false, configured: true, targetRoot, code: "TIMEOUT" }),
  );
}

async function checkSpool(): Promise<HealthCheck> {
  try {
    const { getSpoolStatus } = await import("./capture-spool");
    const status = await getSpoolStatus();
    return {
      // Antrean yang berisi bukan kegagalan -- itu justru rancangannya bekerja.
      // Yang menjadikannya "tidak ok" adalah kapasitas yang hampir habis, sebab
      // di titik itu capture berikutnya akan DITOLAK.
      ok: status.bytes < status.capBytes * 0.9,
      configured: status.configured,
      pending: status.pending,
      bytes: status.bytes,
      capBytes: status.capBytes,
      usedPercent: status.capBytes > 0 ? Math.round((status.bytes / status.capBytes) * 100) : 0,
      oldestQueuedAt: status.oldestQueuedAt ? new Date(status.oldestQueuedAt).toISOString() : null,
    };
  } catch (error: unknown) {
    return {
      ok: false,
      code: "SPOOL_UNREADABLE",
      message: errorMessage(error, "Antrean gagal dibaca."),
    };
  }
}

async function checkDatabase(): Promise<HealthCheck> {
  if (!isCardDbConfigured()) return { ok: false, configured: false, code: "NOT_CONFIGURED" };
  return withTimeout(
    (async (): Promise<HealthCheck> => {
      try {
        const pool = await getCardDbPool();
        await pool.request().query("SELECT 1 AS ok;");
        return { ok: true, configured: true, code: null };
      } catch (error: unknown) {
        return {
          ok: false,
          configured: true,
          code: "UNREACHABLE",
          message: errorMessage(error, "Registry MSSQL tidak terjangkau."),
        };
      }
    })(),
    HEALTH_CHECK_TIMEOUT_MS,
    () => ({ ok: false, configured: true, code: "TIMEOUT" }),
  );
}

async function handleHealth(): Promise<Response> {
  const [networkShare, spool, database] = await Promise.all([
    checkNetworkShare(),
    checkSpool(),
    checkDatabase(),
  ]);

  const checks = { networkShare, spool, database };
  const ok = Object.values(checks).every((check) => check.ok);

  // Status kamera SENGAJA tidak ikut di sini. Canon-nya tidur sendiri saat
  // menganggur -- itu perilaku normal, bukan gangguan -- jadi memasukkannya
  // membuat health hampir selalu "degraded" dan sinyalnya berhenti dibaca
  // orang. Kondisi kamera dilihat di halaman Devices.
  return json(
    { status: ok ? "ok" : "degraded", checkedAt: new Date().toISOString(), checks },
    ok ? 200 : 503,
  );
}

// --- GET /api/v1/docs & /api/v1/openapi.yaml ----------------------------------

function handleSpec(): Response {
  return new Response(openapiSpec, {
    headers: {
      // Bentuk resmi sejak RFC 9512. Ditulis lengkap dengan charset supaya
      // Swagger UI tidak menebak encoding-nya sendiri.
      "content-type": "application/yaml; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function handleDocs(): Response {
  return new Response(renderApiDocsPage(`${API_PREFIX}/openapi.yaml`), {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

// --- GET /api/v1/plants -------------------------------------------------------

function handlePlants(): Response {
  return json({
    plants: PLANTS.map((plant) => ({
      name: plant,
      code: toLocationToken(plant),
      slots: BIN_SLOTS.map((slot) => ({
        slot,
        label: toBinLabel(plant, slot),
        title: toBinTitle(plant, slot),
      })),
    })),
    sessions: CAPTURE_SESSION_HOURS.map((hour) => ({ hour, label: formatSessionLabel(hour) })),
  });
}

// --- GET /api/v1/captures -----------------------------------------------------

const CAPTURE_COLUMNS = `
  cr.id,
  cr.file_name,
  cr.file_path,
  cr.captured_at,
  cr.status,
  cr.file_size_bytes,
  cr.checksum_sha256,
  cr.metadata_json,
  cr.created_at,
  l.plant,
  l.station`;

/**
 * Plant dan sesi tersimpan di dalam `metadata_json`, jadi keduanya disaring
 * dengan JSON_VALUE (SQL Server 2016+) -- bukan ditarik semua lalu disaring di
 * memori, yang akan membuat `total` dan halaman berikutnya salah hitung.
 *
 * Plant di-COALESCE dengan kolom locations supaya record lama yang metadatanya
 * belum memuat plant tetap ikut tersaring.
 */
const CAPTURE_FILTERS = `
  WHERE (@plant IS NULL OR COALESCE(JSON_VALUE(cr.metadata_json, '$.plant'), l.plant) = @plant)
    AND (@session IS NULL OR JSON_VALUE(cr.metadata_json, '$.captureSession') = @session)
    AND (@status IS NULL OR cr.status = @status)
    AND (@from IS NULL OR cr.captured_at >= @from)
    AND (@to IS NULL OR cr.captured_at < @to)`;

type CaptureFilters = {
  plant: string | null;
  session: string | null;
  status: string | null;
  from: Date | null;
  to: Date | null;
};

function bindCaptureFilters(request: sql.Request, filters: CaptureFilters): sql.Request {
  return request
    .input("plant", sql.NVarChar(100), filters.plant)
    .input("session", sql.NVarChar(20), filters.session)
    .input("status", sql.NVarChar(30), filters.status)
    .input("from", sql.DateTime2, filters.from)
    .input("to", sql.DateTime2, filters.to);
}

async function handleCapturesList(url: URL): Promise<Response> {
  const limit = parseLimit(url.searchParams.get("limit"));
  if (isParamError(limit)) return apiError(400, "INVALID_PARAM", limit.error);
  const offset = parseOffset(url.searchParams.get("offset"));
  if (isParamError(offset)) return apiError(400, "INVALID_PARAM", offset.error);
  const from = parseRangeBound(url.searchParams.get("from"), "from");
  if (isParamError(from)) return apiError(400, "INVALID_PARAM", from.error);
  const to = parseRangeBound(url.searchParams.get("to"), "to");
  if (isParamError(to)) return apiError(400, "INVALID_PARAM", to.error);

  const filters: CaptureFilters = {
    plant: url.searchParams.get("plant"),
    session: url.searchParams.get("session"),
    status: url.searchParams.get("status"),
    from,
    to,
  };

  const schema = `[${getCardDbSchema()}]`;
  const pool = await getCardDbPool();

  const countResult = await bindCaptureFilters(pool.request(), filters).query(`
    SELECT COUNT_BIG(1) AS total
    FROM ${schema}.capture_records cr
    LEFT JOIN ${schema}.locations l ON l.id = cr.location_id
    ${CAPTURE_FILTERS};`);

  const pageResult = await bindCaptureFilters(pool.request(), filters)
    .input("limit", sql.Int, limit)
    .input("offset", sql.Int, offset).query(`
      SELECT ${CAPTURE_COLUMNS}
      FROM ${schema}.capture_records cr
      LEFT JOIN ${schema}.locations l ON l.id = cr.location_id
      ${CAPTURE_FILTERS}
      ORDER BY cr.captured_at DESC, cr.id DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;`);

  const total = Number(countResult.recordset[0]?.total ?? 0);
  // `row` dianotasi eksplisit karena `mssql` tidak membawa berkas deklarasi,
  // jadi recordset-nya bertipe any dan parameternya akan implicit-any.
  const items = pageResult.recordset.map((row: unknown) =>
    mapCaptureRecordRow(row as Record<string, unknown>),
  );

  return json({
    items,
    pagination: { limit, offset, total, hasMore: offset + items.length < total },
  });
}

async function handleCaptureById(rawId: string): Promise<Response> {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id < 1) {
    return apiError(400, "INVALID_PARAM", `id capture tidak sah: ${rawId}`);
  }

  const schema = `[${getCardDbSchema()}]`;
  const pool = await getCardDbPool();
  const result = await pool.request().input("id", sql.BigInt, id).query(`
    SELECT ${CAPTURE_COLUMNS}
    FROM ${schema}.capture_records cr
    LEFT JOIN ${schema}.locations l ON l.id = cr.location_id
    WHERE cr.id = @id;`);

  const row = result.recordset[0];
  if (!row) return apiError(404, "NOT_FOUND", `Capture ${id} tidak ditemukan.`);
  return json(mapCaptureRecordRow(row as Record<string, unknown>));
}

// --- GET /api/v1/sessions -----------------------------------------------------

function toCoverageRecord(view: CaptureRecordView): CoverageRecord {
  return {
    id: view.id,
    fileName: view.fileName,
    filePath: view.filePath,
    capturedAt: view.capturedAt,
    captureSession: view.captureSession,
    captureBin: view.captureBin,
    plant: view.plant,
    status: view.status,
    capturedBy: view.capturedBy,
  };
}

async function handleSessions(url: URL): Promise<Response> {
  const rawDate = url.searchParams.get("date");
  if (rawDate !== null && !BARE_DATE.test(rawDate.trim())) {
    return apiError(400, "INVALID_PARAM", `date harus berbentuk YYYY-MM-DD, bukan: ${rawDate}`);
  }
  const date = rawDate ? rawDate.trim() : toLocalDateKey(new Date());

  const requestedPlant = url.searchParams.get("plant");
  if (requestedPlant !== null && !(PLANTS as readonly string[]).includes(requestedPlant)) {
    return apiError(400, "INVALID_PARAM", `plant tidak dikenal: ${requestedPlant}`);
  }
  const plants = requestedPlant ? [requestedPlant] : [...PLANTS];

  // Jendela ambil sengaja lebih lebar dari satu hari: sesi 23.00 di-capture
  // setelah tengah malam (hari berikutnya menurut jam dinding), dan
  // `captured_at` tersimpan dalam UTC sementara tanggal sesi bersifat lokal.
  // Penyaringan yang sebenarnya dilakukan buildSessionCoverage() atas tanggal
  // sesi, bukan atas jam dinding.
  const dayStart = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(dayStart.getTime())) {
    return apiError(400, "INVALID_PARAM", `date bukan tanggal yang sah: ${date}`);
  }
  const windowStart = new Date(dayStart.getTime() - 24 * 60 * 60 * 1000);
  const windowEnd = new Date(dayStart.getTime() + 2 * 24 * 60 * 60 * 1000);

  const schema = `[${getCardDbSchema()}]`;
  const pool = await getCardDbPool();
  const result = await pool
    .request()
    .input("from", sql.DateTime2, windowStart)
    .input("to", sql.DateTime2, windowEnd).query(`
      SELECT ${CAPTURE_COLUMNS}
      FROM ${schema}.capture_records cr
      LEFT JOIN ${schema}.locations l ON l.id = cr.location_id
      WHERE cr.captured_at >= @from AND cr.captured_at < @to
      ORDER BY cr.captured_at ASC, cr.id ASC;`);

  const records = result.recordset.map((row: unknown) =>
    toCoverageRecord(mapCaptureRecordRow(row as Record<string, unknown>)),
  );

  const coverage = buildSessionCoverage({ date, plants, records });
  return json({ date, ...coverage });
}

// --- pengarah -----------------------------------------------------------------

type Route = { method: string; pattern: RegExp; handle: (url: URL, params: string[]) => unknown };

const ROUTES: Route[] = [
  { method: "GET", pattern: /^\/docs$/, handle: () => handleDocs() },
  { method: "GET", pattern: /^\/openapi\.yaml$/, handle: () => handleSpec() },
  { method: "GET", pattern: /^\/health$/, handle: () => handleHealth() },
  { method: "GET", pattern: /^\/plants$/, handle: () => handlePlants() },
  { method: "GET", pattern: /^\/captures$/, handle: (url) => handleCapturesList(url) },
  { method: "GET", pattern: /^\/captures\/([^/]+)$/, handle: (_url, p) => handleCaptureById(p[0]) },
  { method: "GET", pattern: /^\/sessions$/, handle: (url) => handleSessions(url) },
];

/** Endpoint yang membaca registry; dipakai untuk menjawab 503 yang jelas
 * ketika CARDDB belum dikonfigurasi, alih-alih 500 dari koneksi yang gagal. */
const NEEDS_DATABASE = /^\/(captures|sessions)/;

/**
 * Dua endpoint yang dibuka tanpa kunci: halaman Swagger UI dan spesifikasinya.
 *
 * Browser tidak bisa menyisipkan header `X-API-Key` saat membuka sebuah URL,
 * jadi mensyaratkan kunci di sini berarti halaman dokumentasinya tidak akan
 * pernah bisa dibuka orang -- dan tombol "Authorize" di dalamnya, tempat kunci
 * itu semestinya dimasukkan, ikut tidak terjangkau.
 *
 * Yang terbuka hanya BENTUK API-nya, bukan datanya: seluruh endpoint data
 * tetap menuntut kunci, dan spesifikasi yang sama sudah ada di repo. Keduanya
 * pun tetap ikut mati kalau API_KEYS kosong -- tidak ada gunanya memajang
 * dokumentasi untuk API yang sedang tidak melayani siapa pun.
 */
const PUBLIC_PATHS = new Set(["/docs", "/openapi.yaml"]);

export async function handleApiRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.slice(API_PREFIX.length) || "/";

  if (!(PUBLIC_PATHS.has(path) && isApiEnabled())) {
    const auth = authenticateApiRequest(request);
    if (!auth.ok) {
      return json(
        { error: { code: auth.code, message: auth.message } },
        auth.status,
        // Menyebut skema yang dipakai, supaya klien yang gagal tahu harus
        // mengirim apa tanpa perlu membuka dokumentasi.
        auth.status === 401 ? { "www-authenticate": `ApiKey header="${API_KEY_HEADER}"` } : {},
      );
    }
  }

  const matched = ROUTES.find((route) => route.pattern.test(path));
  if (!matched) {
    return apiError(404, "NOT_FOUND", `Endpoint tidak dikenal: ${request.method} ${url.pathname}`);
  }
  if (request.method !== matched.method) {
    return json(
      {
        error: {
          code: "METHOD_NOT_ALLOWED",
          message: `${url.pathname} hanya menerima ${matched.method}. API ini baca-saja.`,
        },
      },
      405,
      { allow: matched.method },
    );
  }

  if (NEEDS_DATABASE.test(path) && !isCardDbConfigured()) {
    return apiError(
      503,
      "CARDDB_NOT_CONFIGURED",
      "Konfigurasi CARDDB belum lengkap di app server ini.",
    );
  }

  try {
    const params = matched.pattern.exec(path)?.slice(1) ?? [];
    return (await matched.handle(url, params)) as Response;
  } catch (error: unknown) {
    // Pesan aslinya dicatat di log server, bukan dikirim ke klien: pesan error
    // MSSQL memuat nama server, database, dan kadang potongan query.
    console.error(`[api] ${request.method} ${url.pathname}`, error);
    return apiError(500, "INTERNAL_ERROR", "Permintaan gagal diproses di app server.");
  }
}
