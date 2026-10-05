# Flexible schedule release — 2026-10-05

Source revision: `4b8e79d2b377971e6e518064ca22a22b5a70476a`, pushed to main and deployed successfully. Runtime source label matches this exact commit. This evidence follow-up changes documentation only and does not require rebuilding the application.

Local verification: 47 suites / 401 tests pass; web/backend and mobile builds pass. All tracked-source ESLint passes with the existing formatter rule excluded, and direct Prettier checks for changed source pass. Combined formatter-enabled repository lint did not finish locally and was stopped; the GitHub Lint job was still running at release verification. Root TypeScript retains 50 baseline errors with no new error messages; mobile TypeScript passes. Static UI audit retains 13 previous findings.

Isolated browser checks cover Settings preview/save/history, invalid input, concurrent-write conflict and draft-preserving reload; mobile open/upcoming sessions, capture completion, closed-window blocking and failed-schedule Retry. Candidate image smoke passes with no network or host mounts.

Production acceptance: the web service is healthy; authenticated schedules and session reads pass; public TLS login, referenced and changed application assets, and the configured mobile API schedule read pass. Existing runtime configuration, persistent storage and other services are retained. A compatible prior image and private configuration checkpoint are retained for rollback; rollback was not exercised. No database migration, real schedule edit or physical capture was performed as a smoke test. Private operational audit remains outside the public repository.

APK 1.1.0 debug / versionCode 2 is built and v1/v2 signatures verified. SHA256: `4B9A3BE029467277E3F19C14788BDE5F1D3CC442BC9B587D4108C9B80FDE6841`. Install before mobile capture because older APKs lack the mandatory signed finalize receipt. Android WebView access to the configured HTTPS API was verified. Physical APK login, camera capture and final photo-storage acceptance remain pending user verification.

Schedule administration: Settings → Jadwal capture per plant. Set start hour, interval, window, timezone and an effective date tomorrow or later. Defaults remain unchanged. Changes guide manual sampling and do not automatically fire the camera. Historical schedule versions remain preserved.
