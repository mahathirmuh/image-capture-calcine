import { createRequire } from "node:module";
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { BottomNav } from "../../mobile/src/components/BottomNav";
import { LanguageSwitch } from "../../mobile/src/components/LanguageSwitch";
import {
  DICTIONARIES,
  describeError,
  getLanguage,
  isLanguage,
  plantLabel,
  roleLabel,
  setLanguage,
  translate,
  type TranslationKey,
} from "../../mobile/src/lib/i18n";

// Renderer runs without a browser, like the other mobile component tests.
const { create, act } = createRequire(import.meta.url)("react-test-renderer") as {
  create: (element: ReturnType<typeof createElement>) => {
    root: {
      findAllByType: (type: string) => { props: Record<string, unknown>; children: unknown[] }[];
    };
    unmount(): void;
  };
  act: (callback: () => void | Promise<void>) => Promise<void>;
};
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

afterEach(() => setLanguage("en"));

describe("mobile dictionaries", () => {
  const keys = Object.keys(DICTIONARIES.en) as TranslationKey[];

  it("has a Chinese entry for every English key, with the same placeholders", () => {
    expect(Object.keys(DICTIONARIES.zh).sort()).toEqual([...keys].sort());
    for (const key of keys) {
      expect(DICTIONARIES.zh[key].trim(), key).not.toBe("");
      expect(placeholders(DICTIONARIES.zh[key]), key).toEqual(placeholders(DICTIONARIES.en[key]));
    }
  });

  it("leaves no entry identical to its English text", () => {
    const same = keys.filter((key) => DICTIONARIES.zh[key] === DICTIONARIES.en[key]);
    expect(same).toEqual([]);
  });
});

describe("language switching", () => {
  it("starts in English and switches every lookup", () => {
    expect(getLanguage()).toBe("en");
    expect(translate("capture.captureAria")).toBe("Capture image");
    setLanguage("zh");
    expect(translate("capture.captureAria")).toBe("拍摄图像");
    expect(translate("history.showing", { count: 20 })).toBe("显示最新 20 条记录");
    expect(roleLabel("operator")).toBe("操作员");
    expect(plantLabel("ALL")).toBe("全部工厂");
    expect(plantLabel("Acid Plant")).toBe("Acid Plant");
  });

  it("accepts only the two supported languages", () => {
    expect(isLanguage("zh")).toBe(true);
    expect(isLanguage("id")).toBe(false);
    expect(isLanguage(undefined)).toBe(false);
  });

  it("re-renders mounted components when the switch is used", async () => {
    let renderer!: ReturnType<typeof create>;
    await act(() => {
      renderer = create(
        createElement(
          "div",
          null,
          createElement(LanguageSwitch, { onChange: setLanguage }),
          createElement(BottomNav, { activeTab: "sessions", onChange: () => undefined }),
        ),
      );
    });
    const labels = () =>
      renderer.root
        .findAllByType("span")
        .map((node) => node.children.join(""))
        .filter((text) => !/^[a-z_]+$/.test(text));
    expect(labels()).toContain("Sessions");

    const chinese = renderer.root
      .findAllByType("button")
      .find((button) => button.children.join("") === "中文")!;
    await act(() => (chinese.props.onClick as () => void)());

    expect(labels()).toContain("场次");
    expect(labels()).not.toContain("Sessions");
    expect(chinese.props["aria-pressed"]).toBe(true);
    renderer.unmount();
  });
});

describe("error wording", () => {
  it("words a known backend code in the interface language, not the server's", () => {
    const error = { code: "SESSION_CONFLICT", message: "Kamera sedang dipakai client lain." };
    expect(describeError(error, "capture.actionError")).toContain("another device");
    setLanguage("zh");
    expect(describeError(error, "capture.actionError")).toContain("另一台设备");
  });

  it("explains why the schedule rejected a capture", () => {
    const rejected = (message: string) => ({ code: "CAPTURE_SCHEDULE_REJECTED", message });
    expect(
      describeError(
        rejected("SESSION_CLOSED: Jendela capture telah berakhir."),
        "capture.actionError",
      ),
    ).toBe("The capture window for this session has ended.");
    expect(describeError(rejected("INVALID_SESSION: Sesi tidak ada."), "capture.actionError")).toBe(
      "This session is not part of the plant schedule.",
    );
    expect(describeError(rejected("something else"), "capture.actionError")).toBe(
      "This session is not open for capture.",
    );
  });

  it("falls back to the message, then to the screen's generic wording", () => {
    expect(
      describeError({ code: "BRAND_NEW_CODE", message: "Pesan server" }, "detail.loadError"),
    ).toBe("Pesan server");
    expect(describeError(null, "detail.loadError")).toBe("Unable to load capture detail.");
    expect(
      describeError({ code: "REQUEST_FAILED", status: 502, message: "x" }, "detail.loadError"),
    ).toBe("Request failed with status 502.");
    expect(describeError(new TypeError("Failed to fetch"), "detail.loadError")).toBe(
      "Cannot reach the server. Check the network connection.",
    );
  });
});
