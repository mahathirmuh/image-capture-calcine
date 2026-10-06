import { passwordStrengthMessages as m } from "@/i18n/users";
import { translateId, type Message, type Translator } from "@/lib/i18n";

export type PasswordScore = 0 | 1 | 2 | 3 | 4;

export type PasswordStrength = {
  score: PasswordScore;
  label: string;
  /** Satu saran paling berguna, atau null kalau sudah tidak ada yang perlu diperbaiki. */
  hint: string | null;
};

export const STRENGTH_LABELS: Record<PasswordScore, Message> = {
  0: m.veryWeak,
  1: m.weak,
  2: m.fair,
  3: m.strong,
  4: m.veryStrong,
};

/**
 * Tebakan pertama siapa pun yang mencoba masuk paksa. Daftarnya sengaja pendek
 * dan spesifik ke lingkungan ini -- nama perusahaan dan nama aplikasi termasuk,
 * karena itulah yang paling sering dipakai orang saat diminta membuat password
 * di aplikasi internal.
 */
const TEBAKAN_PERTAMA = [
  "password",
  "passw0rd",
  "12345678",
  "123456789",
  "1234567890",
  "qwerty123",
  "admin123",
  "administrator",
  "superadmin",
  "operator",
  "merdeka",
  "merdekabattery",
  "calcine",
  "capture",
  "sampling",
  "abcd1234",
  "iloveyou",
  "letmein",
];

function kelasKarakter(password: string) {
  return [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((pola) => pola.test(password)).length;
}

/** Empat karakter sama berturut-turut, misalnya "aaaa" atau "1111". */
function punyaPengulangan(password: string) {
  return /(.)\1{3,}/.test(password);
}

/** Empat karakter berurutan naik atau turun, misalnya "abcd", "4321", "wxyz". */
function punyaUrutan(password: string) {
  const kode = [...password.toLowerCase()].map((huruf) => huruf.charCodeAt(0));
  let naik = 1;
  let turun = 1;
  for (let i = 1; i < kode.length; i += 1) {
    naik = kode[i] === kode[i - 1] + 1 ? naik + 1 : 1;
    turun = kode[i] === kode[i - 1] - 1 ? turun + 1 : 1;
    if (naik >= 4 || turun >= 4) return true;
  }
  return false;
}

function mengandung(password: string, potongan: string | undefined) {
  if (!potongan) return false;
  const bersih = potongan.trim().toLowerCase();
  // Potongan sependek satu-dua huruf akan cocok dengan hampir apa pun.
  if (bersih.length < 3) return false;
  return password.toLowerCase().includes(bersih);
}

/**
 * Menilai kekuatan password.
 *
 * Panjang dihargai lebih besar daripada campuran simbol. "P@ss1!" memenuhi
 * semua kotak centang klasik dan tetap jatuh dalam hitungan detik, sementara
 * empat kata biasa yang panjang jauh lebih tahan -- jadi saran yang diberikan
 * mendorong panjang lebih dulu, bukan menyuruh menambah tanda seru.
 *
 * Konteks (username, nama lengkap) ikut dinilai karena password yang memuat
 * identitas pemiliknya adalah tebakan paling awal, bukan tebakan terakhir.
 *
 * `t` menentukan bahasa label dan saran; tanpa itu hasilnya bahasa Indonesia.
 */
export function assessPassword(
  password: string,
  context?: { username?: string; fullName?: string },
  t: Translator = translateId,
): PasswordStrength {
  if (!password) {
    return { score: 0, label: t(STRENGTH_LABELS[0]), hint: null };
  }

  const lower = password.toLowerCase();
  const kelas = kelasKarakter(password);

  let poin = 0;
  if (password.length >= 8) poin += 1;
  if (password.length >= 12) poin += 1;
  if (password.length >= 16) poin += 1;
  if (kelas >= 3) poin += 1;

  if (punyaPengulangan(password) || punyaUrutan(password)) poin -= 1;
  if (kelas === 1 && password.length < 12) poin -= 1;

  let batas = 4;
  let hint: string | null = null;

  // Tiga hal di bawah bukan sekadar pengurang poin: masing-masing membuat
  // password bisa ditebak lebih dulu daripada apa pun yang dihitung di atas,
  // jadi keduanya memasang langit-langit, bukan potongan nilai.
  if (TEBAKAN_PERTAMA.some((umum) => lower === umum || lower.startsWith(umum))) {
    batas = 0;
    hint = t(m.hintFirstGuess);
  } else if (mengandung(password, context?.username)) {
    batas = 1;
    hint = t(m.hintUsername);
  } else if (
    context?.fullName &&
    context.fullName
      .trim()
      .split(/\s+/)
      .some((kata) => mengandung(password, kata))
  ) {
    batas = 1;
    hint = t(m.hintOwnName);
  }

  const score = Math.max(0, Math.min(batas, poin)) as PasswordScore;

  if (!hint) {
    if (password.length < 12) {
      hint = t(m.hintLength);
    } else if (kelas < 2) {
      hint = t(m.hintMix);
    } else if (punyaPengulangan(password) || punyaUrutan(password)) {
      hint = t(m.hintPattern);
    }
  }

  return { score, label: t(STRENGTH_LABELS[score]), hint };
}
