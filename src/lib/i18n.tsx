import {
  createContext,
  Fragment,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";

// Bahasa antarmuka web. Indonesia adalah bahasa asal seluruh teks dan tetap
// menjadi bawaan; English dan 中文 adalah terjemahannya.
//
// Teksnya TIDAK dikumpulkan di satu kamus raksasa. Tiap halaman punya berkas
// pesannya sendiri di src/i18n/ (lewat defineMessages), dan sebuah pesan adalah
// objek { id, en, zh } -- jadi terjemahan yang tertinggal adalah error tipe,
// dan kamus sebuah halaman hanya ikut ke bundle halaman itu.
export const LANGUAGES = ["id", "en", "zh"] as const;
export type Language = (typeof LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = "id";

/** Ditulis dengan aksaranya sendiri, supaya terbaca oleh penuturnya. */
export const LANGUAGE_NAMES: Record<Language, string> = {
  id: "Indonesia",
  en: "English",
  zh: "中文",
};

// Pilihan disimpan di cookie, bukan localStorage: server ikut membacanya,
// sehingga HTML hasil SSR sudah dalam bahasa yang benar dan tidak berkedip
// dari Indonesia ke bahasa pilihan setiap kali halaman dimuat.
export const LANGUAGE_COOKIE = "capture-calcine-lang";
const COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

export type Message = Readonly<Record<Language, string>>;
export type MessageParams = Record<string, string | number>;
export type Translator = (message: Message, params?: MessageParams) => string;

/** Membuat kamus sebuah halaman. Hanya memeriksa bentuknya; isinya dikembalikan apa adanya. */
export function defineMessages<T extends Record<string, Message>>(messages: T): T {
  return messages;
}

export function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && (LANGUAGES as readonly string[]).includes(value);
}

export function parseLanguage(value: unknown): Language {
  return isLanguage(value) ? value : DEFAULT_LANGUAGE;
}

function render(language: Language, message: Message, params?: MessageParams): string {
  const template = message[language] ?? message.id;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

// Satu penerjemah per bahasa: identitasnya berubah tepat saat bahasa berganti,
// jadi aman dipakai di daftar dependensi hook.
const TRANSLATORS: Record<Language, Translator> = {
  id: (message, params) => render("id", message, params),
  en: (message, params) => render("en", message, params),
  zh: (message, params) => render("zh", message, params),
};

export function translatorFor(language: Language): Translator {
  return TRANSLATORS[language];
}

/**
 * Penerjemah bahasa Indonesia, untuk nilai bawaan parameter `t` pada fungsi
 * pustaka yang juga dipanggil server atau tes -- keduanya tidak punya bahasa
 * pilihan, dan teks asalnya memang Indonesia.
 */
export const translateId: Translator = TRANSLATORS.id;

// Dua locale, karena tampilan bahasa Indonesia memang memakai dua gaya sejak
// sebelum ada pilihan bahasa, dan gaya itu harus tetap sama persis:
// - stempel waktu ditulis gaya en-GB ("06 Oct 2026 14:05:22");
// - beberapa tempat memakai gaya Indonesia ("05 Okt", "1.234 kejadian").
// Untuk English dan 中文 keduanya sama.
const LOCALES: Record<Language, string> = { id: "en-GB", en: "en-GB", zh: "zh-CN" };
const NATIVE_LOCALES: Record<Language, string> = { id: "id-ID", en: "en-GB", zh: "zh-CN" };

/** Locale stempel waktu untuk Intl dan toLocale*String. */
export function localeOf(language: Language): string {
  return LOCALES[language];
}

/** Locale bahasa itu sendiri: nama bulan dan pemisah ribuan menurut bahasanya. */
export function nativeLocaleOf(language: Language): string {
  return NATIVE_LOCALES[language];
}

function readLanguageCookie(): Language | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${LANGUAGE_COOKIE}=([^;]+)`));
  return match && isLanguage(match[1]) ? match[1] : null;
}

// Keadaan di sisi browser. Di server nilainya selalu bawaan dan tidak dipakai:
// di sana bahasa datang per permintaan lewat I18nProvider.
let clientLanguage: Language = readLanguageCookie() ?? DEFAULT_LANGUAGE;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getClientLanguage(): Language {
  return clientLanguage;
}

/** Mengganti bahasa di browser ini, menyimpannya, dan merender ulang yang tampil. */
export function setLanguage(next: Language): void {
  if (typeof document !== "undefined") {
    document.cookie = `${LANGUAGE_COOKIE}=${next}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
  }
  if (next === clientLanguage) return;
  clientLanguage = next;
  for (const listener of listeners) listener();
}

const LanguageContext = createContext<Language | null>(null);

/**
 * Dipasang sekali di root. `ssrLanguage` adalah bahasa yang dibaca server dari
 * cookie permintaan; browser memakai nilai yang sama saat hidrasi, lalu
 * mengikuti pilihan pengguna.
 */
export function I18nProvider({
  ssrLanguage,
  children,
}: {
  ssrLanguage: Language;
  children: ReactNode;
}) {
  const language = useSyncExternalStore(subscribe, getClientLanguage, () => ssrLanguage);

  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-CN" : language;
  }, [language]);

  return <LanguageContext.Provider value={language}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): Language {
  const fromProvider = useContext(LanguageContext);
  // Halaman galat dan 404 dirender di luar provider; di sana bahasa dibaca
  // langsung dari keadaan browser.
  const standalone = useSyncExternalStore(subscribe, getClientLanguage, () => DEFAULT_LANGUAGE);
  return fromProvider ?? standalone;
}

/** Penerjemah untuk komponen: `const t = useT(); t(m.judul)`. */
export function useT(): Translator {
  return TRANSLATORS[useLanguage()];
}

export type RichTranslator = (message: Message, parts: Record<string, ReactNode>) => ReactNode;

/**
 * Seperti useT, tetapi placeholder diisi elemen React -- untuk kalimat yang
 * memuat <code>, <strong>, atau tautan di tengahnya. Urutan kata tiap bahasa
 * tetap benar karena posisi elemennya ditentukan oleh teks terjemahannya:
 *
 *   rich(m.hint, { code: <code>operator.bin1</code> })
 */
export function useRichT(): RichTranslator {
  const language = useLanguage();
  return (message, parts) =>
    (message[language] ?? message.id).split(/(\{\w+\})/).map((piece, index) => {
      const name = /^\{(\w+)\}$/.exec(piece)?.[1];
      return <Fragment key={index}>{name && name in parts ? parts[name] : piece}</Fragment>;
    });
}

/** Locale bahasa yang sedang dipakai, untuk format tanggal dan angka. */
export function useLocale(): string {
  return LOCALES[useLanguage()];
}

/** Seperti useLocale, untuk tempat yang dalam bahasa Indonesia memakai gaya id-ID. */
export function useNativeLocale(): string {
  return NATIVE_LOCALES[useLanguage()];
}
