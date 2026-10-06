# Web interface languages — 2026-10-06

The web app can be used in three languages: **Indonesia** (default, the original text), **English**
and **中文** (Simplified Chinese). The switch is the globe menu in the top bar and on the login page.
Mobile has its own two-language switch (English / 中文); see `mobile/docs/functional-specification.md`.

## How it works

- `src/lib/i18n.tsx` is the core. A message is an object `{ id, en, zh }`, created with
  `defineMessages`. Components call `const t = useT()` and render `t(m.someMessage, { count })`.
  `useRichT()` fills placeholders with React elements (for `<code>`, `<strong>`, links inside a
  sentence). `useLocale()` gives the locale for dates and numbers.
- Each page has its own dictionary in `src/i18n/` (`capture.ts`, `gallery.ts`, `devices.ts`,
  `device-register.ts`, `storage.ts`, `dashboard.ts`, `log.ts`, `sidebar.ts`, `users.ts`,
  `settings.ts`, `login.ts`), plus `common.ts` (navigation, roles, shell), `errors.ts` (server failure
  codes) and `device-status.ts` (edge/camera status sentences). About 1,700 messages in total.
- The choice is stored in the cookie `capture-calcine-lang` (one year). The server reads it during
  SSR (`fetchUiLanguage` in `src/lib/auth.ts`, called from the root route), so the first HTML is
  already in the chosen language and hydration matches. In the browser the language lives in a small
  store; switching re-renders the page without reloading and without a server round trip.
- A missing translation is a **type error** (`Message` requires all three languages), and
  `src/lib/i18n.test.ts` checks every dictionary under `src/i18n/`: all three languages present, the
  same `{placeholders}`, and Chinese entries actually written in Chinese.

## Rules when adding or changing text

1. Never hard-code visible text in a component. Add a message to the page's dictionary and render it
   with `t(...)`. The `id` text is the Indonesian source and follows `UI_LANGUAGE_STYLE_GUIDE.md`.
2. Module-level constants hold `Message` objects, never translated strings; translate at render time.
   Library helpers that produce UI text take the translator as an optional last parameter
   (`t: Translator = translateId`), so server code and tests keep the Indonesian text.
3. Not translated: plant names, slot labels (Train 1, Bin 2), file names and paths, device codes,
   filename tokens (`{YYYY}`, `{SESSION}`), text stored in the database (activity log, device events,
   capture metadata), exported CSV/JSON content and file names, and `console` output.
4. Server failures: return a `code` with every `{ ok: false, message }`. `failureText(t, failure)`
   shows the server's Indonesian sentence in Indonesian and the translation of the code in the other
   languages. A failure without a code, or with a code missing from `src/i18n/errors.ts`, is shown in
   Indonesian in every language.

## Terminology

| Indonesian (as written) | English | Chinese |
| --- | --- | --- |
| Dashboard / Capture / Gallery / Devices / Storage / Users / Log / Settings | same as Indonesian | 仪表板 / 拍摄 / 图库 / 设备 / 存储 / 用户 / 日志 / 设置 |
| capture (verb), ambil foto | capture, take photo | 拍摄 |
| ambil ulang | retake | 重拍 |
| sesi (jadwal sampling) | session | 场次 |
| session / lease kamera | camera session | 相机会话 |
| kamera | camera | 相机 |
| Edge API, edge device, Mini PC | Edge API, edge device, Mini PC | Edge API、边缘设备、迷你电脑 |
| live preview / preview | live preview / preview | 实时预览 / 预览 |
| folder jaringan, share | network folder, share | 网络文件夹、共享 |
| antrean kirim | send queue | 发送队列 |
| registry | registry | 登记表 |
| plant / station / device | plant / station / device | 工厂 / 工位 / 设备 |
| preset / thumbnail | preset / thumbnail | 预设 / 缩略图 |
| Super Admin / Operator / Viewer | Super Admin / Operator / Viewer | 超级管理员 / 操作员 / 查看者 |
| aktif / nonaktif | active / inactive | 启用 / 停用 |
| terhubung / terputus | connected / disconnected | 已连接 / 已断开 |
| jadwal / jendela capture | schedule / capture window | 排程 / 拍摄时间窗 |

## Dates and numbers

Indonesian keeps the two styles it had before the switch existed: timestamps in `en-GB` form
(`06 Oct 2026 14:05:22`, `useLocale()`), and a few places in Indonesian form (`05 Okt`,
`1.234 kejadian`, `useNativeLocale()`). English uses `en-GB`, Chinese `zh-CN`.

## Known limits

- Server failure messages without a code stay Indonesian in English and Chinese. This affects mainly
  the admin pages (Users, Edge API settings, device registry writes, activity log loading). Schedule
  validation errors are recognised by their exact Indonesian text.
- Browser tab titles (route `head` metadata) are static and not translated.
- Text already stored at the time of an event (a status line, an error banner) stays in the language
  it was created in until it is refreshed.
- English has no plural handling ("1 photos").
- The Chinese and English wording was written without review by a native-speaking operator.
- REST messages (`/api/v1`) are unchanged and Indonesian; the mobile app translates them from their
  error codes.

## Verification (2026-10-06)

- 50 test suites / 426 tests pass. TypeScript reports no error that is not already on `main`
  (52 pre-existing). ESLint (formatter rule excluded) reports no errors on the changed files; Prettier
  passes.
- Production build (`vite build`) succeeds, and the built server renders `/login` in each language
  from the cookie.
- Browser walkthrough in headless Chrome against an isolated dev server (no database, no camera, a
  locally sealed admin session): Login, Dashboard, Capture, Gallery, Devices, Register Device,
  Storage, Users, Log and Settings were opened in Indonesian, English and Chinese. No console or
  hydration errors; a scan of the rendered text in English and Chinese found no Indonesian text apart
  from one thrown configuration error that only appears when the database is not configured.
  Switching language, the stored cookie and reload persistence were checked on the login page.
- Not verified: the pages with real data (database, camera, share), and the Viewer and Operator
  roles in a browser.
- `docs/openapi.yaml` reviewed: no REST route, payload or message changed. `getDeviceStatus`
  (a server function, not REST) now also returns `statusInfo`, and the login server function returns
  a `code` with failures.
