import fs from "node:fs";
import path from "node:path";

import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const mobileEnv = loadEnv(mode, __dirname, "VITE_");
  const rootEnv = loadEnv(mode, path.resolve(__dirname, ".."), "");
  const packageJson = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "package.json"), "utf8"),
  ) as { version?: string };
  const firstApiKey =
    rootEnv.API_KEYS?.split(",")
      .map((value) => value.trim())
      .find(Boolean) || "";

  return {
    base: "./",
    plugins: [react()],
    define: {
      __MOBILE_DEFAULT_API_BASE_URL__: JSON.stringify(
        mobileEnv.VITE_API_BASE_URL?.trim() ||
          rootEnv.MOBILE_API_BASE_URL?.trim() ||
          rootEnv.API_BASE_URL?.trim() ||
          "",
      ),
      __MOBILE_DEFAULT_API_KEY__: JSON.stringify(
        mobileEnv.VITE_API_KEY?.trim() || rootEnv.MOBILE_API_KEY?.trim() || firstApiKey,
      ),
      __MOBILE_APP_VERSION__: JSON.stringify(packageJson.version?.trim() || "0.0.0"),
    },
  };
});
