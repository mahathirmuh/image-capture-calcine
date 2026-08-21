// Di-alias supaya namanya tidak lagi diawali "use": ini API request-scoped
// milik TanStack Start, bukan React hook, dan aturan rules-of-hooks eslint
// menilainya semata dari nama pemanggilan.
import { useSession as openSealedSession } from "@tanstack/react-start/server";

import type { SessionUser } from "../auth";
import { getServerEnv } from "../env";

export type AppSessionData = {
  user?: SessionUser;
};

const SESSION_NAME = "capture-calcine-session";

// 12 jam -- satu shift penuh plus lebih. Operator tidak perlu login ulang di
// tengah shift, dan sesi yang tertinggal di PC bersama tetap mati sebelum
// shift berikutnya masuk.
const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;

export function getSessionSecret() {
  const secret = getServerEnv().SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "SESSION_SECRET belum diisi di environment server, jadi sesi login tidak bisa ditandatangani.",
    );
  }
  return secret;
}

export function isSessionConfigured() {
  return Boolean(getServerEnv().SESSION_SECRET);
}

/**
 * Sesi disegel (dienkripsi + ditandatangani) oleh TanStack Start, jadi seluruh
 * isinya ada di cookie dan tidak perlu tabel session di SQL Server.
 */
export function getAppSession() {
  return openSealedSession<AppSessionData>({
    password: getSessionSecret(),
    name: SESSION_NAME,
    maxAge: SESSION_MAX_AGE_SECONDS,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      // App ini dilayani lewat HTTP biasa di jaringan plant (10.60.10.59),
      // bukan HTTPS. Dengan `secure: true` -- default TanStack Start --
      // browser membuang cookie-nya diam-diam: login terlihat berhasil tapi
      // halaman berikutnya kembali menendang ke /login. Ubah ke true kalau
      // app dipindah ke belakang reverse proxy TLS.
      secure: false,
    },
  });
}
