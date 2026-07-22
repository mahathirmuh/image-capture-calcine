import { describe, expect, it } from "vitest";

import { parseServerEnv } from "./env";

describe("parseServerEnv", () => {
  it("uses the default camera API URL when the variable is unset", () => {
    const env = parseServerEnv({
      CAMERA_API_URL: undefined,
      CAMERA_API_TOKEN: undefined,
      NETWORK_SAVE_ROOT: undefined,
      NITRO_PRESET: undefined,
    });

    expect(env).toMatchObject({
      CAMERA_API_URL: "http://localhost:3000",
      CAMERA_API_TOKEN: undefined,
      NETWORK_SAVE_ROOT: undefined,
      NITRO_PRESET: undefined,
    });
  });

  it("normalizes blank optional values to undefined", () => {
    const env = parseServerEnv({
      CAMERA_API_URL: "http://10.60.20.196:3000",
      CAMERA_API_TOKEN: "   ",
      NETWORK_SAVE_ROOT: "",
      NITRO_PRESET: " ",
    });

    expect(env).toMatchObject({
      CAMERA_API_URL: "http://10.60.20.196:3000",
      CAMERA_API_TOKEN: undefined,
      NETWORK_SAVE_ROOT: undefined,
      NITRO_PRESET: undefined,
    });
  });

  it("preserves configured optional values", () => {
    const env = parseServerEnv({
      CAMERA_API_URL: "https://camera.internal:8443",
      CAMERA_API_TOKEN: "secret-token",
      NETWORK_SAVE_ROOT: "\\\\10.1.1.44\\Data Analythics\\ML\\MTI",
      NITRO_PRESET: "node-server",
    });

    expect(env).toEqual({
      CAMERA_API_URL: "https://camera.internal:8443",
      CAMERA_API_TOKEN: "secret-token",
      NETWORK_SAVE_ROOT: "\\\\10.1.1.44\\Data Analythics\\ML\\MTI",
      NITRO_PRESET: "node-server",
    });
  });

  it("fails fast when CAMERA_API_URL is invalid", () => {
    expect(() =>
      parseServerEnv({
        CAMERA_API_URL: "not-a-url",
        CAMERA_API_TOKEN: undefined,
        NETWORK_SAVE_ROOT: undefined,
        NITRO_PRESET: undefined,
      }),
    ).toThrowError(/CAMERA_API_URL/i);
  });
});
