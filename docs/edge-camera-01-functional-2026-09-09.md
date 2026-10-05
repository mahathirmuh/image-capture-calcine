# Camera API functional test — 2026-09-09

Target: http://10.60.20.155:3000, edge-camera-01, Canon EOS R50. Tested approximately 12:18–12:21 Asia/Shanghai.

| Check | Result |
| --- | --- |
| Health, identity, USB readiness | PASS, HTTP 200, ready/connected |
| Camera configuration read | PASS, 8 settings returned |
| SD storage | PASS, SD1 readWrite, 59,105,476,608 bytes free |
| Exclusive lease conflict | PASS, initial acquisition rejected with 409 while existing web lease active; no forced release performed |
| Create/renew/release test lease | PASS, HTTP 201/200/204 |
| Live preview | PASS, 3 successive JPEG frames, 1077/832/793 ms |
| Autofocus command | PASS, job succeeded in about 0.61 seconds; optical focus quality not confirmed |
| Still capture | PASS, one capture job succeeded in 9.30 seconds |
| Camera and edge storage | PASS, storedOnCamera and storedLocally true |
| Media metadata/download | PASS, 2,892,701-byte JPEG; downloaded size and SHA-256 match API metadata |
| Final device state | PASS, ready/connected |

Camera file: /store_00020001/DCIM/100CANON/IMG_0564.JPG.
Asset ID: 57110534-3969-4862-81ce-53e5d520a2a4.

## Image quality and scope

The inspected preview and 6000x4000 captured JPEG are nearly black. API transport, shutter workflow and file integrity pass; scene visibility/exposure and optical autofocus quality are not established. Check lens cover, lighting and exposure before operational image-quality acceptance. No exposure settings were changed by this test.

Test photos remain on camera and edge; a local copy is in `.capture-verification/edge-camera-01-retest-capture-image.jpg`. The test lease was released. Existing web lease expired naturally before acquisition. No capture was finalized into the Capture Calcine registry/network share. Config writes, manual focus steps, file deletion, long-duration streaming, and mobile/web end-to-end capture were not tested.

Raw evidence: `edge-camera-01-retest-2026-09-09.json`. Initial conflict evidence: `edge-camera-01-retest-2026-09-09-session-conflict.json`. No application source or API contract changed.
