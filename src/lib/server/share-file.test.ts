import { mkdtemp, mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Root-nya diganti per tes, jadi nilainya dipegang di variabel yang di-hoist
// bersama mock-nya. share-file.ts membaca getServerEnv() di setiap panggilan,
// bukan sekali saat modul dimuat, sehingga ini cukup.
const state = vi.hoisted(() => ({ root: "" }));

vi.mock("../env", () => ({
  getServerEnv: () => ({ NETWORK_SAVE_ROOT: state.root }),
}));

import { deleteShareFile, renameShareFile } from "./share-file";

let root = "";
let outside = "";

beforeEach(async () => {
  const base = await mkdtemp(join(tmpdir(), "share-file-"));
  root = join(base, "Foto Sampling");
  outside = join(base, "di luar");
  await mkdir(root, { recursive: true });
  await mkdir(outside, { recursive: true });
  state.root = root;
});

afterEach(async () => {
  await rm(join(root, ".."), { recursive: true, force: true }).catch(() => {});
});

/** Buat berkas capture lengkap dengan folder plant/tanggalnya. */
async function seedCapture(name = "11.00 Train 1.jpg"): Promise<string> {
  const dir = join(root, "Acid Plant", "2026", "08", "27");
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, name);
  await writeFile(filePath, "jpeg-pura-pura");
  return filePath;
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

describe("deleteShareFile", () => {
  it("membuang berkasnya dari share", async () => {
    const filePath = await seedCapture();
    expect(await deleteShareFile(filePath)).toEqual({ ok: true, changed: true });
    expect(await exists(filePath)).toBe(false);
  });

  // Keadaan yang benar-benar terjadi di lapangan: ada yang menghapus berkasnya
  // langsung lewat Explorer, lalu kartunya masih tertinggal di galeri. Kalau
  // ini dihitung gagal, baris registry-nya jadi tidak bisa dibersihkan siapa
  // pun -- yatim selamanya.
  it("menghitung berkas yang sudah tidak ada sebagai berhasil", async () => {
    const filePath = join(root, "Acid Plant", "2026", "08", "27", "sudah dihapus orang.jpg");
    expect(await exists(filePath)).toBe(false);
    expect(await deleteShareFile(filePath)).toEqual({ ok: true, changed: true });
  });

  it("menolak path di luar root dan tidak menyentuh berkasnya", async () => {
    const stray = join(outside, "rahasia.jpg");
    await writeFile(stray, "jangan-disentuh");
    const result = await deleteShareFile(stray);
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ code: "OUTSIDE_ROOT" });
    expect(await exists(stray)).toBe(true);
  });

  it("melewati path semu unduhan browser", async () => {
    expect(await deleteShareFile("browser-download/11.00 Train 1.jpg")).toEqual({
      ok: true,
      changed: false,
    });
  });

  it("tidak melakukan apa-apa kalau NETWORK_SAVE_ROOT kosong", async () => {
    const filePath = await seedCapture();
    state.root = "";
    expect(await deleteShareFile(filePath)).toEqual({ ok: true, changed: false });
    expect(await exists(filePath)).toBe(true);
  });
});

describe("renameShareFile", () => {
  it("mengubah nama berkasnya di share", async () => {
    const from = await seedCapture();
    const to = join(root, "Acid Plant", "2026", "08", "27", "11.00 Train 2.jpg");
    expect(await renameShareFile(from, to)).toEqual({ ok: true, changed: true });
    expect(await exists(from)).toBe(false);
    expect(await exists(to)).toBe(true);
  });

  // Menimpa diam-diam berarti membuang foto yang tidak diminta siapa pun.
  it("menolak menimpa berkas yang sudah ada", async () => {
    const from = await seedCapture();
    const to = await seedCapture("11.00 Train 2.jpg");
    const result = await renameShareFile(from, to);
    expect(result).toMatchObject({ ok: false, code: "SHARE_NAME_TAKEN" });
    expect(await exists(from)).toBe(true);
    expect(await exists(to)).toBe(true);
  });

  it("membiarkan record yang berkasnya belum mendarat di share", async () => {
    const dir = join(root, "Acid Plant", "2026", "08", "27");
    await mkdir(dir, { recursive: true });
    const from = join(dir, "belum sampai.jpg");
    const to = join(dir, "nama baru.jpg");
    expect(await renameShareFile(from, to)).toEqual({ ok: true, changed: false });
  });

  it("menolak tujuan di luar root", async () => {
    const from = await seedCapture();
    const result = await renameShareFile(from, join(outside, "kabur.jpg"));
    expect(result).toMatchObject({ ok: false, code: "OUTSIDE_ROOT" });
    expect(await exists(from)).toBe(true);
    expect(await readdir(outside)).toEqual([]);
  });
});
