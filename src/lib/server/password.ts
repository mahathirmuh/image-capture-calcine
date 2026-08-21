import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";
import { promisify } from "node:util";

// promisify() hanya memungut overload 3-argumen dari scrypt, sehingga parameter
// biaya (N/r/p) ikut hilang dari tipenya. Dideklarasikan ulang di sini supaya
// pemanggilan 4-argumen di bawah tetap tervalidasi TypeScript.
const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

// scrypt ships with Node, so the app keeps its zero-native-dependency install
// (bcrypt/argon2 both need a toolchain, and this app is developed on Windows
// where that is the difference between `bun install` working and not).
//
// N=16384/r=8 costs ~16 MB and ~50 ms per hash on the plant server -- slow
// enough to make an offline crack of a stolen hash expensive, fast enough that
// an operator does not notice it on the login screen.
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 } as const;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const PREFIX = "scrypt";

/**
 * Encoded as `scrypt$N$r$p$salt$hash` (both base64) so the cost parameters
 * travel with the hash. Raising SCRYPT_PARAMS later keeps verifying every
 * password already stored under the old cost.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = await scryptAsync(normalize(password), salt, KEY_LENGTH, {
    ...SCRYPT_PARAMS,
  });

  return [
    PREFIX,
    SCRYPT_PARAMS.N,
    SCRYPT_PARAMS.r,
    SCRYPT_PARAMS.p,
    salt.toString("base64"),
    derived.toString("base64"),
  ].join("$");
}

/**
 * Never throws: a row whose password_hash was hand-edited, truncated by a
 * too-small column, or written by some other tool simply fails to verify. A
 * throw here would surface as a 500 on the login screen and tell an attacker
 * that the account exists.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parsed = parseStoredHash(stored);
  if (!parsed) return false;

  try {
    const derived = await scryptAsync(normalize(password), parsed.salt, parsed.hash.length, {
      N: parsed.N,
      r: parsed.r,
      p: parsed.p,
    });

    return timingSafeEqual(derived, parsed.hash);
  } catch {
    return false;
  }
}

// Operators type passwords on a mix of Windows keyboards and Android soft
// keyboards, which can emit different Unicode encodings of the same accented
// character. Normalizing both at hash and verify time keeps those equal.
function normalize(password: string) {
  return password.normalize("NFKC");
}

function parseStoredHash(stored: string) {
  if (typeof stored !== "string") return null;

  const parts = stored.split("$");
  if (parts.length !== 6) return null;

  const [prefix, rawN, rawR, rawP, rawSalt, rawHash] = parts;
  if (prefix !== PREFIX) return null;

  const N = Number(rawN);
  const r = Number(rawR);
  const p = Number(rawP);
  if (!isPositiveInt(N) || !isPositiveInt(r) || !isPositiveInt(p)) return null;

  const salt = Buffer.from(rawSalt, "base64");
  const hash = Buffer.from(rawHash, "base64");
  if (salt.length === 0 || hash.length === 0) return null;

  return { N, r, p, salt, hash };
}

function isPositiveInt(value: number) {
  return Number.isInteger(value) && value > 0;
}
