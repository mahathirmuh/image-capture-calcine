import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  // Use one React instance for the renderer and mobile's separate installation.
  resolve: { alias: { react: fileURLToPath(new URL("./node_modules/react", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    restoreMocks: true,
    clearMocks: true,
  },
});
