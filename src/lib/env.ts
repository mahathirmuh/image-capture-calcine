import { z } from "zod";

function emptyStringToUndefined(value: unknown) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

const serverEnvSchema = z.object({
  CAMERA_API_URL: z.preprocess(
    emptyStringToUndefined,
    z.string().url().default("http://localhost:3000"),
  ),
  CAMERA_API_TOKEN: z.preprocess(emptyStringToUndefined, z.string().optional()),
  NETWORK_SAVE_ROOT: z.preprocess(emptyStringToUndefined, z.string().optional()),
  // Antrean lokal di app server. Setiap capture ditulis ke sini lebih dulu,
  // lalu diteruskan ke NETWORK_SAVE_ROOT -- langsung kalau share sehat,
  // menyusul kalau tidak. Harus menunjuk volume yang bertahan melewati
  // `docker compose up --build`, kalau tidak antrean ikut terhapus saat deploy.
  CAPTURE_SPOOL_DIR: z.preprocess(emptyStringToUndefined, z.string().optional()),
  // Batas ukuran antrean. Saat terlampaui, capture DITOLAK dengan pesan jelas
  // -- bukan membuang entri terlama. Operator yang ditolak tahu ada masalah dan
  // bisa memanggil bantuan; entri yang dibuang diam-diam hilang tanpa jejak.
  CAPTURE_SPOOL_MAX_MB: z.preprocess(
    emptyStringToUndefined,
    z.coerce.number().int().positive().default(2048),
  ),
  // Kunci akses REST API baca-saja di /api/v1, dipisah koma kalau lebih dari
  // satu. KOSONG BERARTI API MATI (setiap permintaan dijawab 503), bukan
  // terbuka: sebuah API yang menyala diam-diam karena variabelnya lupa diisi
  // adalah kegagalan yang tidak terlihat sampai ada yang menemukannya.
  //
  // Beri satu kunci per konsumen, jangan dipakai bersama -- kunci bersama tidak
  // bisa dicabut tanpa memutus semua yang lain sekaligus.
  API_KEYS: z.preprocess(emptyStringToUndefined, z.string().optional()),
  // Origin browser yang boleh memanggil /api/v1 lintas-domain. Pisahkan koma.
  // Kosong = pakai daftar aman bawaan untuk localhost/webview mobile.
  API_ALLOWED_ORIGINS: z.preprocess(emptyStringToUndefined, z.string().optional()),
  // Thumbnail galeri (~50 KB per capture), dibuat di browser operator lalu
  // dititipkan ke sini. Kosong = fitur mati: galeri jatuh ke memuat foto
  // ukuran penuh dari folder jaringan, seperti sebelum thumbnail ada.
  //
  // Volume terpisah dari antrean kirim: antrean kosong berarti semuanya sudah
  // terkirim, sementara thumbnail justru harus bertahan selama record-nya ada.
  CAPTURE_THUMBS_DIR: z.preprocess(emptyStringToUndefined, z.string().optional()),
  CARDDB_USER: z.preprocess(emptyStringToUndefined, z.string().optional()),
  CARDDB_PASSWORD: z.preprocess(emptyStringToUndefined, z.string().optional()),
  CARDDB_SERVER: z.preprocess(emptyStringToUndefined, z.string().optional()),
  CARDDB_NAME: z.preprocess(emptyStringToUndefined, z.string().optional()),
  CARDDB_PORT: z.preprocess(emptyStringToUndefined, z.coerce.number().int().positive().optional()),
  CARDDB_SCHEMA: z.preprocess(emptyStringToUndefined, z.string().optional()),
  // Kunci penyegel cookie sesi login. Panjang minimum 32 karakter dipaksakan
  // oleh algoritma seal TanStack Start -- nilai yang lebih pendek ditolak saat
  // runtime, jadi lebih baik gagal di sini dengan pesan yang jelas.
  SESSION_SECRET: z.preprocess(
    emptyStringToUndefined,
    z.string().min(32, "minimal 32 karakter").optional(),
  ),
  NITRO_PRESET: z.preprocess(emptyStringToUndefined, z.string().optional()),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

function formatZodIssues(error: z.ZodError) {
  return error.issues
    .map((issue) => {
      const path = issue.path.join(".") || "root";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const parsed = serverEnvSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Invalid server environment configuration: ${formatZodIssues(parsed.error)}`);
  }
  return parsed.data;
}

let cachedServerEnv: ServerEnv | undefined;

// Server-only runtime config. This module is consumed by Vite config and
// server functions so environment parsing stays centralized and consistent.
export function getServerEnv(): ServerEnv {
  cachedServerEnv ??= parseServerEnv(process.env);
  return cachedServerEnv;
}
