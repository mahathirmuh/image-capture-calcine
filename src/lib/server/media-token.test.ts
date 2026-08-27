import { beforeAll, describe, expect, it } from "vitest";

import {
  buildMediaPath,
  createMediaToken,
  MEDIA_TOKEN_TTL_MS,
  verifyMediaToken,
} from "./media-token";

beforeAll(() => {
  // getServerEnv() membaca process.env sekali lalu menyimpannya, dan modul ini
  // tidak memanggilnya saat diimpor -- jadi cukup disiapkan sebelum tes
  // pertama menyentuhnya.
  process.env.SESSION_SECRET = "0123456789abcdef0123456789abcdef";
});

describe("token URL gambar", () => {
  it("menerima tanda tangannya sendiri", async () => {
    const token = await createMediaToken(42);
    const check = await verifyMediaToken(42, String(token.expiresAt), token.signature);
    expect(check.ok).toBe(true);
  });

  // Inti keamanannya: tanda tangan terikat pada SATU record. Tanpa ini,
  // siapa pun yang punya satu URL sah bisa menukar angkanya dan menarik foto
  // plant mana pun.
  it("menolak tanda tangan yang dipakai untuk record lain", async () => {
    const token = await createMediaToken(42);
    const check = await verifyMediaToken(43, String(token.expiresAt), token.signature);
    expect(check).toEqual({ ok: false, code: "BAD_SIGNATURE" });
  });

  it("menolak tanda tangan yang diubah", async () => {
    const token = await createMediaToken(42);
    const tampered = token.signature.slice(0, -1) + (token.signature.endsWith("A") ? "B" : "A");
    const check = await verifyMediaToken(42, String(token.expiresAt), tampered);
    expect(check).toEqual({ ok: false, code: "BAD_SIGNATURE" });
  });

  // Memperpanjang masa berlaku sendiri harus gagal -- kalau tidak, umur
  // pendeknya tidak berarti apa-apa.
  it("menolak masa berlaku yang digeser tanpa tanda tangan baru", async () => {
    const token = await createMediaToken(42);
    const check = await verifyMediaToken(42, String(token.expiresAt + 60_000), token.signature);
    expect(check).toEqual({ ok: false, code: "BAD_SIGNATURE" });
  });

  it("menolak token yang sudah lewat masa berlakunya", async () => {
    const issuedAt = 1_756_000_000_000;
    const token = await createMediaToken(42, issuedAt);
    const check = await verifyMediaToken(
      42,
      String(token.expiresAt),
      token.signature,
      issuedAt + MEDIA_TOKEN_TTL_MS + 1,
    );
    expect(check).toEqual({ ok: false, code: "EXPIRED" });
  });

  it("masih menerima token tepat sebelum kedaluwarsa", async () => {
    const issuedAt = 1_756_000_000_000;
    const token = await createMediaToken(42, issuedAt);
    const check = await verifyMediaToken(
      42,
      String(token.expiresAt),
      token.signature,
      token.expiresAt,
    );
    expect(check.ok).toBe(true);
  });

  it("menolak parameter yang tidak lengkap atau bukan angka", async () => {
    expect(await verifyMediaToken(42, null, "abc")).toEqual({ ok: false, code: "MALFORMED" });
    expect(await verifyMediaToken(42, "123", null)).toEqual({ ok: false, code: "MALFORMED" });
    expect(await verifyMediaToken(42, "bukan-angka", "abc")).toEqual({
      ok: false,
      code: "MALFORMED",
    });
  });

  it("menyusun path yang bisa dipakai langsung oleh <img src>", async () => {
    const path = buildMediaPath(7, { expiresAt: 1_756_000_300_000, signature: "abc+/=def" });
    expect(path.startsWith("/media/7?e=1756000300000&s=")).toBe(true);
    // Tanda tangannya base64url, tapi tetap di-encode -- path yang benar tidak
    // boleh bergantung pada kebetulan alfabetnya bebas karakter URL.
    expect(path).toContain(encodeURIComponent("abc+/=def"));
  });
});
