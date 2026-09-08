import { describe, expect, it } from "vitest";
import { deviceEndpointHost } from "./device-diagnostics";

describe("device endpoint display", () => {
  it("shows endpoint host and port without credentials or private paths", () => {
    expect(deviceEndpointHost("https://user:secret@edge.example:3000/private?token=secret")).toBe(
      "edge.example:3000",
    );
  });
  it("does not turn an invalid configured endpoint into a healthy fallback", () => {
    expect(deviceEndpointHost("broken", "10.0.0.1")).toBe("Alamat Edge API tidak valid");
  });
  it("uses the registered address only when no endpoint is configured", () => {
    expect(deviceEndpointHost(null, "10.0.0.1")).toBe("10.0.0.1");
    expect(deviceEndpointHost(undefined)).toBe("Alamat belum diisi");
  });
});
