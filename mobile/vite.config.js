import fs from "node:fs";
import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(function (_a) {
    var _b, _c, _d, _e, _f, _g, _h;
    var mode = _a.mode;
    var mobileEnv = loadEnv(mode, __dirname, "VITE_");
    var rootEnv = loadEnv(mode, path.resolve(__dirname, ".."), "");
    var packageJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, "package.json"), "utf8"));
    var firstApiKey = ((_b = rootEnv.API_KEYS) === null || _b === void 0 ? void 0 : _b.split(",").map(function (value) { return value.trim(); }).find(Boolean)) || "";
    return {
        base: "./",
        plugins: [react()],
        define: {
            __MOBILE_DEFAULT_API_BASE_URL__: JSON.stringify(((_c = mobileEnv.VITE_API_BASE_URL) === null || _c === void 0 ? void 0 : _c.trim()) ||
                ((_d = rootEnv.MOBILE_API_BASE_URL) === null || _d === void 0 ? void 0 : _d.trim()) ||
                ((_e = rootEnv.API_BASE_URL) === null || _e === void 0 ? void 0 : _e.trim()) ||
                ""),
            __MOBILE_DEFAULT_API_KEY__: JSON.stringify(((_f = mobileEnv.VITE_API_KEY) === null || _f === void 0 ? void 0 : _f.trim()) || ((_g = rootEnv.MOBILE_API_KEY) === null || _g === void 0 ? void 0 : _g.trim()) || firstApiKey),
            __MOBILE_APP_VERSION__: JSON.stringify(((_h = packageJson.version) === null || _h === void 0 ? void 0 : _h.trim()) || "0.0.0"),
        },
    };
});
