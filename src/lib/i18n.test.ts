import { describe, expect, it } from "vitest";

import { errorMessages, failureText } from "../i18n/errors";
import {
  defineMessages,
  isLanguage,
  localeOf,
  parseLanguage,
  translateId,
  translatorFor,
  type Message,
} from "./i18n";

// Every dictionary under src/i18n is picked up automatically, so a page added
// later is checked without touching this file.
const modules = import.meta.glob("../i18n/*.ts", { eager: true }) as Record<
  string,
  Record<string, unknown>
>;

function isMessage(value: unknown): value is Message {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return ["id", "en", "zh"].every((language) => typeof record[language] === "string");
}

const allMessages: { where: string; message: Message }[] = [];
for (const [file, exports] of Object.entries(modules)) {
  for (const [name, exported] of Object.entries(exports)) {
    if (!exported || typeof exported !== "object") continue;
    for (const [key, value] of Object.entries(exported as Record<string, unknown>)) {
      if (isMessage(value)) allMessages.push({ where: `${file} ${name}.${key}`, message: value });
    }
  }
}

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const HAS_CJK = /[㐀-鿿]/;

describe("web dictionaries", () => {
  it("finds the page dictionaries", () => {
    expect(allMessages.length).toBeGreaterThan(100);
  });

  it("has all three languages for every message, with the same placeholders", () => {
    for (const { where, message } of allMessages) {
      expect(message.id.trim(), where).not.toBe("");
      expect(message.en.trim(), where).not.toBe("");
      expect(message.zh.trim(), where).not.toBe("");
      expect(placeholders(message.en), where).toEqual(placeholders(message.id));
      expect(placeholders(message.zh), where).toEqual(placeholders(message.id));
    }
  });

  it("does not leave Chinese entries in another language", () => {
    // A Chinese entry without any Chinese character is only acceptable when it
    // is an identifier kept as-is (ISO, Edge API, OK), i.e. identical to English.
    const untranslated = allMessages
      .filter(({ message }) => !HAS_CJK.test(message.zh) && message.zh !== message.en)
      .map(({ where }) => where);
    expect(untranslated).toEqual([]);
  });
});

describe("translator", () => {
  const m = defineMessages({
    greeting: { id: "Halo, {name}", en: "Hello, {name}", zh: "你好，{name}" },
  });

  it("renders the requested language and fills placeholders", () => {
    expect(translatorFor("id")(m.greeting, { name: "Budi" })).toBe("Halo, Budi");
    expect(translatorFor("en")(m.greeting, { name: "Budi" })).toBe("Hello, Budi");
    expect(translatorFor("zh")(m.greeting, { name: "Budi" })).toBe("你好，Budi");
    expect(translateId(m.greeting)).toBe("Halo, {name}");
  });

  it("falls back to Indonesian for anything that is not a supported language", () => {
    expect(parseLanguage("zh")).toBe("zh");
    expect(parseLanguage("fr")).toBe("id");
    expect(parseLanguage(undefined)).toBe("id");
    expect(isLanguage("en")).toBe(true);
    expect(localeOf("zh")).toBe("zh-CN");
  });
});

describe("failure text", () => {
  const failure = {
    code: "DEVICE_FORBIDDEN",
    message: 'Akun Anda terpasang di Acid Plant, sedangkan "Kamera 2" ada di Chloride Plant.',
  };

  it("keeps the server's detailed Indonesian text in Indonesian", () => {
    expect(failureText(translateId, failure)).toBe(failure.message);
  });

  it("rewrites a known code in the other languages", () => {
    expect(failureText(translatorFor("en"), failure)).toBe(errorMessages.DEVICE_FORBIDDEN.en);
    expect(failureText(translatorFor("zh"), failure)).toBe(errorMessages.DEVICE_FORBIDDEN.zh);
  });

  it("explains a schedule rejection from its reason prefix", () => {
    const rejected = {
      code: "CAPTURE_SCHEDULE_REJECTED",
      message: "SESSION_CLOSED: Jendela capture telah berakhir.",
    };
    expect(failureText(translatorFor("en"), rejected)).toBe(errorMessages.SESSION_CLOSED.en);
  });

  it("falls back to the server text, then to the given message", () => {
    const en = translatorFor("en");
    expect(failureText(en, { code: "SOMETHING_NEW", message: "Pesan server" })).toBe(
      "Pesan server",
    );
    expect(failureText(en, { code: null, message: "" }, errorMessages.FORBIDDEN)).toBe(
      errorMessages.FORBIDDEN.en,
    );
    expect(failureText(en, null)).toBe("");
  });
});
