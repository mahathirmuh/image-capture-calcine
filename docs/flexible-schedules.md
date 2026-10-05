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
