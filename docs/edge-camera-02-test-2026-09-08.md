# edge-camera-02 runtime test — 2026-09-08

Target: http://10.60.20.96:3000 (Chloride Plant, Main Area).
Test window: approximately 16:33–16:35 Asia/Shanghai. Source host: 10.60.20.126.

## Results

| Check | Result | Evidence |
| --- | --- | --- |
| TCP connection, port 3000 | PASS | PowerShell Test-NetConnection: TcpTestSucceeded=True. |
| GET /v1/health | FAIL | Initial Node request timed out at 20 seconds; unauthenticated retry timed out at 10,008 ms. Independent curl without proxy also timed out after 10 seconds with zero response bytes. |
| GET /v1/device | FAIL | Authenticated request timed out at 20 seconds. No camera identity/state response. |
| GET /v1/camera/status | FAIL | Authenticated request timed out at 20 seconds. USB readiness cannot be determined. |
| Create, renew and release lease | BLOCKED | API readiness prerequisite failed; no session created. |
| Live preview | BLOCKED | No usable API response or session. |
| Autofocus | BLOCKED | No usable API response or session. |
| Capture, job completion, media download | BLOCKED | No capture command sent. No image created/downloaded by this test. |
| Camera config/storage capability checks | BLOCKED | API readiness prerequisite failed. |

Control check from the same host: edge-camera-01 health at http://10.60.20.155:3000 returned HTTP 200 in 145 ms with status=ok and agentVersion=0.1.0. This demonstrates this host can reach another edge HTTP API, but does not identify the cause at edge-camera-02.

Conclusion: edge-camera-02 is not verified operational. TCP accepts connections, but the application does not return HTTP responses. The evidence does not establish whether the camera USB, API process, or intervening network component is the cause. Inspect edge-camera-02 process/container logs and local health response on its host before repeating functional tests.

Scope: direct edge API checks, no application code/configuration changes, no service restart, no database changes. No session was acquired, so there was no test lease to release. Mandatory operator workflow tests were blocked, not passed. Capture Calcine REST/mobile end-to-end behavior remains untested in this run.
