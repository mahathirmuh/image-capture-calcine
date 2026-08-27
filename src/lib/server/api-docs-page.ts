// Halaman Swagger UI untuk /api/v1/docs.
//
// Aset Swagger UI DIBUNDEL SENDIRI di public/api-docs/, bukan ditarik dari CDN.
// Server produksi berdiri di jaringan pabrik yang tidak selalu punya jalan ke
// internet; halaman dokumentasi yang bergantung pada unpkg akan tampil kosong
// justru di tempat ia paling dibutuhkan.

/** Versi swagger-ui-dist yang disalin ke public/api-docs/. Dicatat di sini
 * supaya jelas apa yang harus diunduh ulang saat menaikkan versi. */
export const SWAGGER_UI_VERSION = "5.32.14";

export function renderApiDocsPage(specUrl: string): string {
  return `<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Capture Calcine API</title>
    <link rel="stylesheet" href="/api-docs/swagger-ui.css" />
    <link rel="icon" href="/favicon.ico" />
    <style>
      body { margin: 0; background: #fafafa; }
      .swagger-ui .topbar { display: none; }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="/api-docs/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: ${JSON.stringify(specUrl)},
        dom_id: "#swagger-ui",
        presets: [SwaggerUIBundle.presets.apis],
        layout: "BaseLayout",
        // Swagger UI secara bawaan mengirim URL spesifikasi ke
        // validator.swagger.io untuk menampilkan lencana "valid". Itu panggilan
        // KELUAR dari browser pemakai ke internet -- gagal di jaringan pabrik,
        // dan membocorkan alamat internal kalau berhasil.
        validatorUrl: null,
        // Kunci API TIDAK disimpan di browser. Halaman ini kerap dibuka dari PC
        // bersama di area plant, dan kunci yang mengendap di localStorage akan
        // tetap di sana untuk pemakai berikutnya.
        persistAuthorization: false,
        docExpansion: "list",
        defaultModelsExpandDepth: 0,
        tryItOutEnabled: true,
      });
    </script>
  </body>
</html>
`;
}
