import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const mobileRoot = resolve(__dirname, "..");
const androidDir = resolve(mobileRoot, "android");

function run(command, cwd = mobileRoot) {
  execSync(command, {
    cwd,
    stdio: "inherit",
    env: process.env,
  });
}

run("npm run build");

if (!existsSync(androidDir)) {
  run("npx cap add android");
}

run("npx cap sync android");
run("./gradlew assembleDebug", androidDir);
