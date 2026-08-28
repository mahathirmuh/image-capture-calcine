import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ secret: "" as string | undefined }));

vi.mock("../env", () => ({
  getServerEnv: () => ({ SESSION_SECRET: state.secret }),
}));

import {
  API_TOKEN_TTL_MS,
  clearRevokedApiTokens,
  createApiToken,
  isApiTokenConfigured,
  revokeApiToken,
  verifyApiToken,
} from "./api-token";

const USER = { id: 7, username: "operator.ap", role: "Operator" };

beforeEach(() => {
  state.secret = "rahasia-uji-yang-panjangnya-lebih-dari-32-karakter";
  clearRevokedApiTokens();
});

afterEach(() => {
  clearRevokedApiTokens();
});

describe("createApiToken", () => {
  it("membawa identitas orangnya, bukan sekadar boleh/tidak", async () => {
    // Inti alasan token ini ada: capturedBy harus bisa menjawab SIAPA.
    const issued = await createApiToken(USER);
    expect(issued).not.toBeNull();
    expect(issued?.claims.userId).toBe(7);
    expect(issued?.claims.username).toBe("operator.ap");
    expect(issued?.claims.role).toBe("Operator");
  });

  it("kedaluwarsa satu shift penuh sejak diterbitkan", async () => {
    const now = 1_700_000_000_000;
    const issued = await createApiToken(USER, now);
    expect(issued?.claims.expiresAt).toBe(now + API_TOKEN_TTL_MS);
  });

  it("memberi tokenId berbeda tiap kali, supaya satu bisa dicabut sendirian", async () => {
    const a = await createApiToken(USER);
    const b = await createApiToken(USER);
    expect(a?.claims.tokenId).not.toBe(b?.claims.tokenId);
  });

  it("menolak menerbitkan tanpa SESSION_SECRET", async () => {
    state.secret = undefined;
    expect(isApiTokenConfigured()).toBe(false);
    expect(await createApiToken(USER)).toBeNull();
  });
});

describe("verifyApiToken", () => {
  it("menerima token yang baru diterbitkan", async () => {
    const issued = await createApiToken(USER);
    const check = await verifyApiToken(issued!.token);
    expect(check.ok).toBe(true);
    if (check.ok) expect(check.claims.username).toBe("operator.ap");
  });

  // Yang paling penting dari seluruh berkas ini: klaim yang diubah harus
  // tertolak. Tanpa ini, siapa pun bisa mengangkat dirinya jadi Super Admin
  // dengan menyunting bagian pertama token.
  it("menolak klaim yang disunting", async () => {
    const issued = await createApiToken(USER);
    const [body, signature] = issued!.token.split(".");
    const claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    claims.role = "Super Admin";
    const forged = Buffer.from(JSON.stringify(claims), "utf8").toString("base64url");
    expect(await verifyApiToken(`${forged}.${signature}`)).toEqual({
      ok: false,
      code: "BAD_SIGNATURE",
    });
  });

  it("menolak token yang ditandatangani secret lain", async () => {
    const issued = await createApiToken(USER);
    state.secret = "secret-yang-berbeda-sama-sekali-dan-cukup-panjang";
    expect(await verifyApiToken(issued!.token)).toEqual({ ok: false, code: "BAD_SIGNATURE" });
  });

  it("membedakan kedaluwarsa dari tanda tangan salah", async () => {
    // Bedanya berarti bagi klien: yang satu cukup login ulang, yang lain
    // berarti tokennya palsu.
    const now = 1_700_000_000_000;
    const issued = await createApiToken(USER, now);
    expect(await verifyApiToken(issued!.token, now + API_TOKEN_TTL_MS + 1)).toEqual({
      ok: false,
      code: "EXPIRED",
    });
  });

  it("menolak bentuk yang tidak karuan", async () => {
    expect(await verifyApiToken("")).toEqual({ ok: false, code: "MALFORMED" });
    expect(await verifyApiToken("tanpatitik")).toEqual({ ok: false, code: "MALFORMED" });
    expect(await verifyApiToken(".hanyatandatangan")).toEqual({ ok: false, code: "MALFORMED" });
    expect(await verifyApiToken("hanyabody.")).toEqual({ ok: false, code: "MALFORMED" });
  });

  it("menolak semuanya kalau SESSION_SECRET dikosongkan", async () => {
    const issued = await createApiToken(USER);
    state.secret = "";
    expect(await verifyApiToken(issued!.token)).toEqual({ ok: false, code: "NOT_CONFIGURED" });
  });
});

describe("revokeApiToken", () => {
  it("mematikan token itu saja, bukan token lain milik orang yang sama", async () => {
    const first = await createApiToken(USER);
    const second = await createApiToken(USER);
    revokeApiToken(first!.claims);

    expect(await verifyApiToken(first!.token)).toEqual({ ok: false, code: "REVOKED" });
    expect((await verifyApiToken(second!.token)).ok).toBe(true);
  });

  it("melupakan pencabutan setelah tokennya kedaluwarsa sendiri", async () => {
    // Daftar pencabutan tidak boleh tumbuh selamanya di memori proses.
    const now = 1_700_000_000_000;
    const issued = await createApiToken(USER, now);
    revokeApiToken(issued!.claims);
    // Sesudah lewat, jawabannya EXPIRED -- diperiksa sebelum daftar cabutan,
    // dan catatannya ikut dibuang.
    expect(await verifyApiToken(issued!.token, now + API_TOKEN_TTL_MS + 1)).toEqual({
      ok: false,
      code: "EXPIRED",
    });
  });
});
