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
