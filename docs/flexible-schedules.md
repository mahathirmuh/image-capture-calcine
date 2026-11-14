# Flexible plant schedules

Admin: Settings → Jadwal capture per plant. Set start hour, interval, window, timezone and an effective date tomorrow or later. Preview displays sessions and expected photos. Defaults are unchanged: 02/05/08/11/14/17/20/23 with a two-hour window, Asia/Makassar. Schedules guide manual sampling; they do not automatically fire a camera.

Versions are append-only in `CAPTURE_SPOOL_DIR/schedules/versions.json`, persisted by the existing Docker spool volume. Back up this file together with the volume; do not remove the spool volume even when its capture queue is empty. Admin changes require fresh role authorization and expected revision, and are serialized by `write.lock`. A stale lock after a process crash blocks writes; verify no writer is running before an administrator removes only that lock. Read/corrupt errors fail closed. Multiple replicas require the same storage and its atomic file-lock semantics; the current deployment has one web instance.

Historical dates use the effective version for that date; changing a future schedule does not reinterpret past coverage. A previous-date window can finish after midnight even when tomorrow's version differs. Indonesia's supported timezones have fixed UTC offsets. Device clock/timezone is not authoritative.

Today Sessions distinguishes Upcoming, Open, Completed and Missing. Recovery selection permits already-started sessions today/yesterday, never future sessions. A server-signed command receipt allows saving after the window closes for up to one hour and binds the completed edge job's asset. Mobile APK 1.1.0 (versionCode 2) is required; older APKs must update before capture verification. Legacy device schedule metadata does not drive this model.

No database migration. Retake filenames and existing photo retention behavior are unchanged. Do not change real production schedules as a smoke test; use local synthetic workflows and authenticated production reads. Physical camera/photo/share acceptance is separate from health and build checks.

## Acid Plant trial track (2026-10-05, removed 2026-11-13 — see the last section)

Web Capture shows two tabs for Acid Plant: **Sesi per 3 jam** (the plant schedule above) and **Sesi per 2 jam (Trial)**. The trial track is a fixed schedule — 00.00, 02.00, 04.00 … every two hours, 120-minute window, Asia/Makassar — defined in `src/lib/capture-schedule.ts` (`trialSchedule`). It is not editable in Settings and is not stored in `versions.json`.

Both tabs use the same Acid Plant camera, lease, operator scope and Train 1/Train 2 slots. Only the session context and destination differ: trial photos are written to `<NETWORK_SAVE_ROOT>/Acid Plant Trial/YYYY/MM/DD/`, regular photos stay in `Acid Plant/`. The server validates a trial capture against the trial schedule (`track` on the capture server function).

Trial records keep `plant = Acid Plant` and carry `captureTrack: "trial"` in `metadata_json`; they are excluded from `/sessions` coverage so they never mark a regular session as captured. Records without the key are regular. No database migration.

The spool's "forwarded" marker now matches on the destination path as well as file name, because `02.00 Train 1.jpg` exists in both folders.

Mobile (APK 1.2.0 / versionCode 3) has the same two tabs on Today Sessions and on direct Capture, in English (`3-Hour Sessions` / `2-Hour Trial`). REST: `POST /camera/capture` accepts `track`, the signed receipt carries it, and `POST /captures/finalize` derives the folder from the receipt, never from the request body; `GET /sessions?track=trial` returns trial coverage. Requests without `track` behave as before, so APK 1.1.0 keeps working for regular sessions. Switching tabs in direct Capture releases and re-acquires the camera lease.

Not included: other plants, and a Gallery/History filter for the track.

## Default window is the full interval (2026-10-05)

Supersedes "two-hour window" above: the built-in default schedule now uses a 180-minute window, equal to its 3-hour interval. A session is a range — 11.00 stays open until 14.00 starts — so there is no closed hour between sessions. This applies to every plant that has no saved schedule version, on web and on the REST/mobile path (mobile direct capture no longer shows "Session not available" between sessions). A plant with a saved version keeps that version's window; change it in Settings (effective tomorrow). The trial track keeps a 120-minute window, which equals its 2-hour interval.

The two mobile lifecycle suites that assert out-of-window blocking could not be run on this workstation (missing `react-test-renderer` / `mobile/node_modules`) and must be re-run after `npm install`.

Stored `default-<plant>` rows (written into `versions.json` when the first version is saved) are not admin decisions: on read they are replaced by the current built-in default, so the 180-minute default also applies on servers that already have a `versions.json`. Versions saved by an admin are never altered.

## Acid Plant regular schedule fixed at every 3 hours (2026-10-07)

Owner decision after an admin had saved "every 2 hours from 02:00" for Acid Plant (effective
2026-10-06), which made the "Sesi per 3 jam" tab show 2-hourly sessions and duplicated the trial
track.

- Plants with a trial track (`hasTrialTrack`, today only Acid Plant) use two fixed schedules: regular
  every 3 hours from 02:00 (02, 05, 08, 11, 14, 17, 20, 23), window 180 minutes, and the trial
  schedule every 2 hours.
- `applyFixedRegularSchedules()` (src/lib/capture-schedule.ts) is applied whenever schedules are read
  (`readScheduleSnapshot`): stored versions for such a plant effective 2026-10-07 or later are ignored,
  and a synthetic version `fixed-<plant>` effective 2026-10-07 is appended. Nothing is written to
  `versions.json`; earlier versions stay as history, so 2026-10-06 is still evaluated with the
  2-hour schedule it was captured under.
- Effective for today (2026-10-07) once deployed — the usual "changes start tomorrow" rule is about
  admin edits, and this is a code rule decided by the owner.
- Settings shows the plant's schedule read-only with an explanation; the server refuses to save a
  version for it.
- Web capture page, server capture validation, `/schedules`, `/sessions` and the mobile app all read
  the same snapshot, so APK 1.4.0 follows the change without a new build.

Verification (2026-10-07): 55 suites / 503 tests pass (4 new). The rule applied to the production
schedule fetched read-only from `GET /api/v1/schedules`: Acid Plant regular for 2026-10-06 stays
00.00–22.00 every 2 hours, for 2026-10-07 it is 02.00, 05.00, 08.00, 11.00, 14.00, 17.00, 20.00,
23.00; trial unchanged; at 08:25 WITA the open regular session is 08.00 until 11:00. Mobile
`tsc -b` passes. Not deployed at the time of writing.

## Trial track removed (2026-11-13)

Owner decision: "hapus sesi yang per 2 jam". The trial track had not been used since 16 Oct 2026
(135 trial photos, 5-16 Oct).

- Web Capture and the mobile app (APK 1.5.0 / versionCode 6) no longer show the
  `Sesi per 3 jam` / `Sesi per 2 jam (Trial)` tabs; every plant has one schedule. The fixed-schedule
  note in Settings no longer mentions the trial schedule.
- Acid Plant keeps its fixed 3-hour schedule from the previous section. It is now its own rule
  (`hasFixedRegularSchedule`, a plant list) instead of following `hasTrialTrack`; without it the
  2-hourly version saved for 2026-10-06 would apply again.
- The server refuses `track: "trial"` in `checkScheduledCapture`, which both web `triggerCapture`
  and REST `POST /camera/capture` call before the edge: `409 CAPTURE_SCHEDULE_REJECTED`, message
  `INVALID_SESSION: Sesi per 2 jam (trial) sudah dihapus...`. APK 1.3.0-1.4.0 and stale web tabs in
  English or Chinese show their existing "not part of the plant schedule" wording; Indonesian and
  APK 1.2.0 show the server text. The shutter never fires.
- `GET /sessions?track=trial` is still accepted, so the trial tab of APK 1.2.0-1.4.0 does not turn
  into an error; it always answers without plants and without reading the registry, which leaves that
  tab empty. Older APKs keep working for regular sessions.
- Nothing is deleted. `captureTrack: "trial"`, `trackFolder` and the `Acid Plant Trial` folder stay
  for the archive: Gallery (tag and "Jenis Sesi" filter), the bulk ZIP, Sinkronkan folder, and
  `/sessions`, which still keeps old trial photos out of regular coverage. A capture receipt signed
  for the trial track before the deploy is still finalized into `Acid Plant Trial`.
- `trialSchedule`, `versionsForTrack` and the mobile `TrackTabs` component are removed. No
  database migration.

Verification (2026-11-13): 55 suites / 505 tests pass (four trial-schedule tests replaced by two
archive and fixed-schedule tests; four new: trial refused before the camera on the server
function and over REST, the old trial tab answered empty without a registry query, a pre-removal
trial receipt still filed under `Acid Plant Trial`). Root TypeScript has the same 54 baseline
errors; mobile `tsc -b`, ESLint (formatter rule excluded) and Prettier on the changed files pass;
the production web build passes. Isolated dev server with the production schedule injected
read-only: `/capture` as Operator and Super Admin and `/settings` in id/en/zh show no tab list and no
2-hour wording, the session chip reads 11.00 (the session open at the time), no console errors. APK 1.5.0
(SHA-256 `B911E057D3C60297A80857E18B7CBBAD91149DBCF0D079A6D4CDBA2F402E6635`) installed over 1.4.0
on the Android 15 emulator without uninstalling, simulated operator session with read-only
production data: Today Sessions lists 02:00-23:00 with no tabs (request `/sessions` without
`track`), direct Capture opens "Auto session 11:00" with today's 11.00 result, a session picked from
the list opens without a trial label, Settings shows 1.5.0, Chinese shows no trial wording, no crash
or console error. Not covered: a real sign-in and capture on a phone, and the old-APK behaviour
against a deployed server (covered by the REST tests only). Not deployed at the time of writing.

## Acid Plant hours from 2026-11-14

Owner request (2026-11-14, "waktunya diubah"), based on the slide "Interval 3 Hours Sampling"
dated 11 Nov 2026. That slide covers the trial window 16 Nov-31 Dec 2026 with 8 samplings a day.
Its day shift samples at 09:00, 12:00, 15:00 and 18:00, and its night shift at 21:00, 00:00, 03:00
and 06:00.

- Acid Plant only. Chloride, Pyrite and Copper Cathode keep their own schedules (built-in 02.00
  every 3 hours unless an admin saves a version in Settings).
- The fixed Acid Plant schedule is now 00.00, 03.00, 06.00, 09.00, 12.00, 15.00, 18.00, 21.00. It is
  still every 3 hours with a 180-minute window in Asia/Makassar. The owner decided it stays after
  31 Dec 2026 until changed again.
- Start date. A first version started on 16 Nov, the slide's first trial day, and was deployed. The
  same afternoon the owner asked for it to start immediately ("ubah waktunya sesuai gambar ini").
  The effective date is therefore 2026-11-14, the day of the request. Settings never allows that
  for a stored version.
- Accepted consequence: the 10 Acid Plant photos of 14 Nov taken before the switch (sessions 02.00
  to 14.00, Train 1 and 2) keep their files, names and records. Their labels do not match the new
  hours, so they are not counted in the 14 Nov coverage, and the 00.00 to 12.00 sessions of 14 Nov
  show as missing. A photo whose capture was started before the deploy is still saved under its
  signed session label, because finalize does not re-check the schedule.
- It is a second fixed version, `fixed-Acid Plant-2026-11-14`, next to `fixed-Acid Plant`
  (2026-10-07). Dates up to 13 Nov keep the 02.00 hours.
- From the deploy on, the open session follows the new hours (at 16:55 WITA on 14 Nov that is 15.00
  until 18:00). Every later midnight handover is plain: 21.00 runs until 00:00, then 00.00 starts.
  There is no 02.00 session any more.
- Web capture, server validation, `/schedules`, `/sessions` and the mobile app read the same
  snapshot, so no new APK is needed. The Settings note for Acid Plant lists only the current sampling hours (owner, 14 Nov: "cukup jam jam yang tertera saja"); older hours stay in the collapsed version history.
- The legacy `sessions` list of `GET /plants` keeps the built-in 02.00 hours. It is documented as
  legacy, and consumers use `/schedules`.
