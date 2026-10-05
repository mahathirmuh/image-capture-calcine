# Flexible schedule release — 2026-10-05

Repository: mahathirmuh/image-capture-calcine, branch main. Existing production checkout `/root/image-capture-calcine`; Docker Compose project `image-capture-calcine`, file `docker-compose.yml`, affected service `web`, container `image-capture-calcine`, host port 26101. Existing `.env` remains private and unchanged. Public web: https://capture-calcine.merdekabattery.com. Mobile API: https://calcineapi.justanapi.my.id/api/v1.

Baseline checkout: `4013f7665788e048fa0d041a8a217dff2810b6a1`. Baseline running image: `sha256:a275a92a8372dee6d1be29fc723457d8e2a841efde4cfbc09936c77d642af11a`; it has no revision label, so checkout SHA alone does not prove its source. Retain this image under a unique rollback tag before activation. No database migration; rollback does not require a schema change. Actual rollback is not exercised.

Protected mounts: existing capture-spool and capture-thumbs named volumes, and `/mnt/mti` bind with rslave propagation. Schedule versions persist inside the existing spool volume. Preserve mounts, environment and Compose identity. Build from a tracked archive of the exact pushed commit, label source revision, smoke-check isolated candidate, activate only web without rebuilding/pulling, then verify runtime image/revision/health, authenticated schedule/session reads and public assets. Keep private configuration checkpoint and release audit on the host.

Hermes discovery run `run_7a49323534f342f0ab54468124875c9f` confirmed Docker access but no host checkout/Compose access. Direct pinned-host SSH is the available authorized deployment path. Existing GitHub CI configuration is unchanged; repository/environment deploy secrets were absent during inspection.

Local gates: 47 suites / 401 tests pass, web/backend and mobile builds pass, changed code lint and formatting pass, isolated browser workflows pass, signed debug APK 1.1.0/versionCode 2 generated. Root TypeScript retains 50 baseline errors with no new error messages; static UI audit retains 13 previous findings. Full repository lint has existing failures; changed-code lint is the relevant passing gate. Physical APK/camera/network-share acceptance remains pending. No production schedule edits or capture mutations are part of smoke testing. Install the new APK before mobile capture: older APKs do not send the mandatory signed finalize receipt.

Runtime activation evidence will be appended after deployment, distinguishing image source revision from documentation checkout revision.
