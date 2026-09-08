import { afterEach, describe, expect, it, vi } from "vitest";
import {
  loadSelectedEdgeDevice,
  resolveSelectedEdgeDevice,
  saveSelectedEdgeDevice,
} from "./selected-edge-device";

afterEach(() => vi.unstubAllGlobals());
const devices = [
  { deviceCode: "edge-1", isActive: true },
  { deviceCode: "edge-2", isActive: true },
];

describe("selected edge device", () => {
  it("requires a choice with multiple active devices and no profile", () => {
    expect(resolveSelectedEdgeDevice(devices, "")).toBe("");
  });
  it("restores the saved camera instead of the first registry row", () => {
    expect(resolveSelectedEdgeDevice(devices, "edge-2")).toBe("edge-2");
  });
  it("does not substitute a different camera for an inactive or removed choice", () => {
    expect(
      resolveSelectedEdgeDevice([{ ...devices[0], isActive: false }, devices[1]], "edge-1"),
    ).toBe("");
    expect(resolveSelectedEdgeDevice([devices[1]], "removed")).toBe("");
  });
  it("selects the sole active device when no previous choice exists", () => {
    expect(resolveSelectedEdgeDevice([devices[1]], "")).toBe("edge-2");
    expect(resolveSelectedEdgeDevice([], "")).toBe("");
  });
  it("reads identity from a legacy profile without requiring camera settings", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) =>
          key.includes("device-profile") ? JSON.stringify({ deviceCode: "edge-2" }) : null,
      },
    });
    expect(loadSelectedEdgeDevice()).toBe("edge-2");
  });
  it("persists an explicit selection across reloads", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    });
    saveSelectedEdgeDevice("edge-2");
    expect(loadSelectedEdgeDevice()).toBe("edge-2");
  });
  it("tolerates blocked browser storage", () => {
    vi.stubGlobal("window", {
      get localStorage() {
        throw new Error("blocked");
      },
    });
    expect(loadSelectedEdgeDevice()).toBe("");
    expect(() => saveSelectedEdgeDevice("edge-2")).not.toThrow();
  });
});
