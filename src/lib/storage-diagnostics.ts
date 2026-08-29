import { createServerFn } from "@tanstack/react-start";
import { getServerEnv } from "./env";
import { isPlatformMismatchedRoot } from "./network-path";

export type StorageProbeResult =
  | {
      ok: true;
      targetRoot: string;
      probeFile: string;
      platform: string;
      mode: "write-delete";
      checkedAt: number;
      message: string;
    }
  | {
      ok: false;
      targetRoot: string | null;
      platform: string;
      code: string;
      checkedAt: number;
      message: string;
    };

export const getStorageConfigSummary = createServerFn({ method: "GET" }).handler(async () => {
  const env = getServerEnv();
  return {
    configured: !!env.NETWORK_SAVE_ROOT,
    targetRoot: env.NETWORK_SAVE_ROOT ?? null,
    cameraApiUrl: env.CAMERA_API_URL,
    platform: process.platform,
  };
});

// Diturunkan, bukan disalin. Bentuk yang sama pernah ditulis dua kali di sini
// dan di capture-spool.ts, dan medan yang ditambahkan di satu sisi diam-diam
// hilang dari sisi lain. `import type` terhapus seluruhnya saat kompilasi,
// jadi modul server-only itu tidak ikut tertarik ke bundle browser.
import type { SpoolStatus } from "./server/capture-spool";

export type SpoolSummary = SpoolStatus;

/**
 * Isi antrean kirim di app server.
 *
 * Sejak semua capture lewat antrean, share yang mati tidak lagi menimbulkan
 * gejala apa pun di halaman Capture -- foto tetap "berhasil" dan operator
 * tidak melihat apa-apa. Angka inilah satu-satunya tanda, jadi ia bagian yang
 * menahan kegagalan senyap, bukan sekadar pelengkap halaman Storage.
 */
export const getSpoolSummary = createServerFn({ method: "GET" }).handler(
  async (): Promise<SpoolSummary> => {
    const { getSpoolStatus, ensureSpoolWorker } = await import("./server/capture-spool");
    ensureSpoolWorker();
    return getSpoolStatus();
  },
);

/** Kirim ulang antrean sekarang juga, tanpa menunggu timer lima menitan. */
export const flushSpoolNow = createServerFn({ method: "POST" }).handler(async () => {
  const { flushSpool } = await import("./server/capture-spool");
  const result = await flushSpool();

  // Dicatat karena ini tindakan orang, bukan timer. Kalau antrean tiba-tiba
  // terkirim di tengah gangguan, jejak ini yang menjelaskan siapa yang
  // menekannya -- dan hasilnya, supaya penekanan yang tidak menghasilkan apa
  // pun tetap terlihat.
  const { currentActor, recordActivity } = await import("./server/activity");
  const actor = await currentActor();
  await recordActivity({
    action: "storage.flush_manual",
    severity: result.stoppedBecause && result.pending > 0 ? "warning" : "info",
    actorId: actor?.id ?? null,
    actorUsername: actor?.username ?? null,
    detail:
      `${result.forwarded} terkirim, ${result.pending} tersisa` +
      `${result.stoppedBecause ? `; berhenti: ${result.stoppedBecause}` : ""}`,
  });

  return result;
});

export const probeNetworkSaveRoot = createServerFn({ method: "POST" }).handler(
  async (): Promise<StorageProbeResult> => {
    const checkedAt = Date.now();
    const targetRoot = getServerEnv().NETWORK_SAVE_ROOT ?? null;

    if (!targetRoot) {
      return {
        ok: false,
        targetRoot: null,
        platform: process.platform,
        code: "NOT_CONFIGURED",
        checkedAt,
        message: "NETWORK_SAVE_ROOT is not configured on this app server.",
      };
    }

    // Diperiksa sebelum menyentuh disk: bentuk root yang mustahil di platform
    // ini akan gagal stat dan terbaca sebagai "share belum ter-mount", padahal
    // sebabnya nilai env yang salah bentuk. Pesan yang menuduh hal keliru lebih
    // buruk daripada tidak ada pesan.
    if (isPlatformMismatchedRoot(targetRoot, process.platform)) {
      return {
        ok: false,
        targetRoot,
        platform: process.platform,
        code: "PLATFORM_MISMATCH",
        checkedAt,
        message:
          `NETWORK_SAVE_ROOT berbentuk UNC/Windows (${targetRoot}) padahal app ini berjalan di ` +
          `${process.platform}. Pakai path mount Linux, mis. /mnt/mti/ML/MTI/... -- bentuk UNC ` +
          "tidak bisa dibuka di sini, jadi antrean kirim tidak akan pernah terkirim.",
      };
    }

    try {
      const [{ access, stat, writeFile, unlink }, { constants }, pathModule] = await Promise.all([
        import("node:fs/promises"),
        import("node:fs"),
        import("node:path"),
      ]);

      const joinPath = targetRoot.startsWith("\\\\") ? pathModule.win32.join : pathModule.join;

      const info = await stat(targetRoot);
      if (!info.isDirectory()) {
        return {
          ok: false,
          targetRoot,
          platform: process.platform,
          code: "NOT_DIRECTORY",
          checkedAt,
          message: "Configured NETWORK_SAVE_ROOT exists but is not a directory.",
        };
      }

      await access(targetRoot, constants.R_OK | constants.W_OK);

      const probeFile = `.capture-app-write-test-${checkedAt}.tmp`;
      const probePath = joinPath(targetRoot, probeFile);

      await writeFile(
        probePath,
        [
          "Capture App storage probe",
          `checkedAt=${new Date(checkedAt).toISOString()}`,
          `platform=${process.platform}`,
        ].join("\n"),
        "utf8",
      );
      await unlink(probePath);

      return {
        ok: true,
        targetRoot,
        probeFile,
        platform: process.platform,
        mode: "write-delete",
        checkedAt,
        message: "App server can create and delete a probe file in NETWORK_SAVE_ROOT.",
      };
    } catch (error: unknown) {
      const code =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        typeof (error as { code?: unknown }).code === "string"
          ? (error as { code: string }).code
          : "UNKNOWN";
      const message =
        error instanceof Error ? error.message : "Unknown error while probing the save directory.";

      return {
        ok: false,
        targetRoot,
        platform: process.platform,
        code,
        checkedAt,
        message,
      };
    }
  },
);
