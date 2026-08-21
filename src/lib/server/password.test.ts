import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "./password";

describe("hashPassword", () => {
  it("encodes the cost parameters alongside a per-password salt", async () => {
    const hash = await hashPassword("kalsinasi-2026");
    const [prefix, N, r, p, salt] = hash.split("$");

    expect(prefix).toBe("scrypt");
    expect(Number(N)).toBe(16384);
    expect(Number(r)).toBe(8);
    expect(Number(p)).toBe(1);
    expect(Buffer.from(salt, "base64")).toHaveLength(16);
  });

  it("never produces the same hash twice for the same password", async () => {
    const [first, second] = await Promise.all([hashPassword("ulang"), hashPassword("ulang")]);

    expect(first).not.toBe(second);
    await expect(verifyPassword("ulang", first)).resolves.toBe(true);
    await expect(verifyPassword("ulang", second)).resolves.toBe(true);
  });
});

describe("verifyPassword", () => {
  it("accepts the right password and rejects a near miss", async () => {
    const hash = await hashPassword("Operator#Bin2");

    await expect(verifyPassword("Operator#Bin2", hash)).resolves.toBe(true);
    await expect(verifyPassword("operator#Bin2", hash)).resolves.toBe(false);
    await expect(verifyPassword("Operator#Bin2 ", hash)).resolves.toBe(false);
    await expect(verifyPassword("", hash)).resolves.toBe(false);
  });

  it("treats the two Unicode spellings of an accented password as equal", async () => {
    const composed = "kaf\u00e9-calcine";
    const decomposed = "kafe\u0301-calcine";
    expect(composed).not.toBe(decomposed);

    const hash = await hashPassword(composed);
    await expect(verifyPassword(decomposed, hash)).resolves.toBe(true);
  });

  it("still verifies a hash written under a lower cost than the current default", async () => {
    // Same encoding, N lowered by hand -- what a row hashed by an older build
    // of this module looks like after SCRYPT_PARAMS is raised.
    const { scryptSync, randomBytes } = await import("node:crypto");
    const salt = randomBytes(16);
    const derived = scryptSync("lama", salt, 64, { N: 1024, r: 8, p: 1 });
    const legacy = ["scrypt", 1024, 8, 1, salt.toString("base64"), derived.toString("base64")].join(
      "$",
    );

    await expect(verifyPassword("lama", legacy)).resolves.toBe(true);
    await expect(verifyPassword("baru", legacy)).resolves.toBe(false);
  });

  it("returns false instead of throwing on a corrupt or foreign hash", async () => {
    const cases = [
      "",
      "not-a-hash",
      "scrypt$16384$8$1$onlyfiveparts",
      "bcrypt$16384$8$1$c2FsdA==$aGFzaA==",
      "scrypt$0$8$1$c2FsdA==$aGFzaA==",
      "scrypt$16384$8$1$$aGFzaA==",
      "scrypt$16384$8$1$c2FsdA==$",
    ];

    for (const stored of cases) {
      await expect(verifyPassword("apapun", stored)).resolves.toBe(false);
    }
  });
});
