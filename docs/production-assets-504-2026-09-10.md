# Production asset 504 investigation — 2026-09-10

Target: https://capture-calcine.merdekabattery.com. Read-only checks from the development host.

## Reproduced evidence

| Asset | Original URL | Same URL with unique diagnostic query |
| --- | --- | --- |
| devices-D4WmPsKj.js | 504 text/html | 200 text/javascript |
| cpu-D7VxIZ2t.js | 504 text/html | 200 text/javascript |
| preset-ui-DjFXQz8J.js | 504 text/html | 200 text/javascript |
| csv-_tPmkNNF.js | 504 text/html | 200 text/javascript |

Repeated original-URL requests still failed after successful query variants. Failure responses identify openresty and return the gateway HTML body, typically within tens/hundreds of milliseconds. Root HTML and index-PzIXCZqG.js return 200; current HTML references that same entry chunk. All four files are retrievable as JavaScript using query variants, so the observations do not support missing files as the immediate cause.

Inference: a URL-keyed cache/proxy response issue is strongly indicated. The exact cache layer cannot be established from public response headers alone. A cache, proxy routing rule, or intermediary needs inspection. No Cache-Control header or cache-hit indicator is provided on the 504 response.

## Remediation requiring proxy access

Identify the reverse proxy/cache owner and upstream. Compare original paths directly against the upstream, inspect the asset proxy/cache configuration and logs, then invalidate the failed asset entries in the responsible cache. Prevent gateway errors from being retained as asset responses. Recheck all four original URLs for HTTP 200 with JavaScript content type before considering this resolved. Browser reload alone cannot repair a gateway returning 504 on a fresh HTTP request; changing only the page query does not change imported asset URLs.

An additional probe of a nonexistent asset followed redirects and ended in 200 HTML. This should be reviewed separately: unknown asset paths should not resolve to the login HTML. It is not established as the cause of these four 504 responses.

No code, Compose configuration, deployment or proxy settings were changed. Proxy management host/access is pending user input. A frontend retry or new build hash would only work around the affected cache keys and is not a verified infrastructure repair.
