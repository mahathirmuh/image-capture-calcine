import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

// REST API mesin-ke-mesin. Dicegat di sini, sebelum TanStack Start, karena
// konsumennya bukan browser: tidak ada router, SSR, maupun CSRF yang berlaku
// untuk mereka, dan sebuah 500 di sana tidak boleh menjawab halaman HTML.
//
// Pencocokan path ditulis inline supaya modulnya (yang menarik mssql) hanya
// dimuat ketika ada permintaan API sungguhan.
const API_PREFIX = "/api/v1";

function isApiPath(pathname: string): boolean {
  return pathname === API_PREFIX || pathname.startsWith(`${API_PREFIX}/`);
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      if (isApiPath(new URL(request.url).pathname)) {
        const { handleApiRequest } = await import("./lib/server/api-rest");
        return await handleApiRequest(request);
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      // Konsumen API mendapat JSON, bukan halaman HTML: klien mesin yang
      // menerima <html> pada kegagalan akan melaporkannya sebagai "respons
      // tidak bisa diurai", bukan sebagai server yang sedang bermasalah.
      if (isApiPath(new URL(request.url).pathname)) {
        return new Response(
          JSON.stringify({
            error: { code: "INTERNAL_ERROR", message: "Permintaan gagal diproses di app server." },
          }),
          {
            status: 500,
            headers: {
              "content-type": "application/json; charset=utf-8",
              "cache-control": "no-store",
            },
          },
        );
      }
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
