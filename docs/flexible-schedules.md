# Flexible plant schedules

Admin: Settings → Jadwal capture per plant. Set start hour, interval, window, timezone and an effective date tomorrow or later. Preview displays sessions and expected photos. Defaults are unchanged: 02/05/08/11/14/17/20/23 with a two-hour window, Asia/Makassar. Schedules guide manual sampling; they do not automatically fire a camera.

Versions are append-only in `CAPTURE_SPOOL_DIR/schedules/versions.json`, persisted by the existing Docker spool volume. Back up this file together with the volume; do not remove the spool volume even when its capture queue is empty. Admin changes require fresh role authorization and expected revision, and are serialized by `write.lock`. A stale lock after a process crash blocks writes; verify no writer is running before an administrator removes only that lock. Read/corrupt errors fail closed. Multiple replicas require the same storage and its atomic file-lock semantics; the current deployment has one web instance.

Historical dates use the effective version for that date; changing a future schedule does not reinterpret past coverage. A previous-date window can finish after midnight even when tomorrow's version differs. Indonesia's supported timezones have fixed UTC offsets. Device clock/timezone is not authoritative.

Today Sessions distinguishes Upcoming, Open, Completed and Missing. Recovery selection permits already-started sessions today/yesterday, never future sessions. A server-signed command receipt allows saving after the window closes for up to one hour and binds the completed edge job's asset. Mobile APK 1.1.0 (versionCode 2) is required; older APKs must update before capture verification. Legacy device schedule metadata does not drive this model.

No database migration. Retake filenames and existing photo retention behavior are unchanged. Do not change real production schedules as a smoke test; use local synthetic workflows and authenticated production reads. Physical camera/photo/share acceptance is separate from health and build checks.
