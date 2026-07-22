import { createServerFn } from "@tanstack/react-start";
import { getServerEnv } from "./env";

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
