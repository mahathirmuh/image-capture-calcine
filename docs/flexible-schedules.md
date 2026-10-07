# Flexible plant schedules

Admin: Settings → Jadwal capture per plant. Set start hour, interval, window, timezone and an effective date tomorrow or later. Preview displays sessions and expected photos. Defaults are unchanged: 02/05/08/11/14/17/20/23 with a two-hour window, Asia/Makassar. Schedules guide manual sampling; they do not automatically fire a camera.

Versions are append-only in `CAPTURE_SPOOL_DIR/schedules/versions.json`, persisted by the existing Docker spool volume. Back up this file together with the volume; do not remove the spool volume even when its capture queue is empty. Admin changes require fresh role authorization and expected revision, and are serialized by `write.lock`. A stale lock after a process crash blocks writes; verify no writer is running before an administrator removes only that lock. Read/corrupt errors fail closed. Multiple replicas require the same storage and its atomic file-lock semantics; the current deployment has one web instance.

Historical dates use the effective version for that date; changing a future schedule does not reinterpret past coverage. A previous-date window can finish after midnight even when tomorrow's version differs. Indonesia's supported timezones have fixed UTC offsets. Device clock/timezone is not authoritative.

Today Sessions distinguishes Upcoming, Open, Completed and Missing. Recovery selection permits already-started sessions today/yesterday, never future sessions. A server-signed command receipt allows saving after the window closes for up to one hour and binds the completed edge job's asset. Mobile APK 1.1.0 (versionCode 2) is required; older APKs must update before capture verification. Legacy device schedule metadata does not drive this model.

No database migration. Retake filenames and existing photo retention behavior are unchanged. Do not change real production schedules as a smoke test; use local synthetic workflows and authenticated production reads. Physical camera/photo/share acceptance is separate from health and build checks.

## Acid Plant trial track (2026-10-05)

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
