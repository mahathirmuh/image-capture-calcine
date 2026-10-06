import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { joinNetworkPath } from "../network-path";

// Registry tiruan: baris yang dikembalikan diatur tiap tes.
const state = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[] }));
vi.mock("../carddb", () => ({
  isCardDbConfigured: () => true,
  getCardDbSchema: () => "dbo",
  getCardDbPool: async () => ({
    request: () => ({
      input() {
        return this;
      },
      async query() {
        return { recordset: state.rows };
      },
    }),
  }),
}));

import {
  ZIP_FAILURE_NOTE,
  ZIP_TOKEN_TTL_MS,
  canonicalIds,
  createZipToken,
  handleMediaZipRequest,
  parseIds,
  planZip,
  streamZip,
  verifyZipToken,
  type ZipRecord,
} from "./media-zip";

let root = "";

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "media-zip-"));
  // getServerEnv() membaca process.env sekali lalu menyimpannya.
  process.env.SESSION_SECRET = "0123456789abcdef0123456789abcdef";
  process.env.NETWORK_SAVE_ROOT = root;
});

afterAll(async () => {
  if (root) await rm(root, { recursive: true, force: true });
});

const record = (id: number, segments: string[], extra: Partial<ZipRecord> = {}): ZipRecord => ({
  id,
  fileName: segments[segments.length - 1],
  filePath: joinNetworkPath(root, segments),
  capturedAt: "2026-10-06T00:05:00.000Z",
  plant: "Acid Plant",
  track: "regular",
  fileSizeBytes: 9,
  servable: true,
  ...extra,
});

async function collect(stream: AsyncIterable<Uint8Array>): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) chunks.push(chunk);
  const out = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/** Nama dan isi setiap entri, dibaca dari direktori pusat. */
function listZip(bytes: Uint8Array): Record<string, string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = bytes.length - 22;
  expect(view.getUint32(end, true)).toBe(0x06054b50);
  const count = view.getUint16(end + 10, true);
  let cursor = view.getUint32(end + 16, true);
  const files: Record<string, string> = {};
  for (let index = 0; index < count; index++) {
    const size = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const local = view.getUint32(cursor + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    files[name] = new TextDecoder().decode(bytes.subarray(start, start + size));
    cursor += 46 + nameLength + extraLength;
  }
  return files;
}

describe("signed id lists", () => {
  it("normalises the list that gets signed", () => {
    expect(canonicalIds([7, 3, 7, 12])).toBe("3,7,12");
    expect(parseIds("3,7,12")).toEqual([3, 7, 12]);
  });

  it("rejects lists that are not in the signed form", () => {
    for (const raw of ["", "7,3", "3,3", "3,,7", "3, 7", "abc", "0", "-1", "1.5", null]) {
      expect(parseIds(raw)).toBeNull();
    }
    expect(parseIds(Array.from({ length: 1001 }, (_, index) => index + 1).join(","))).toBeNull();
  });

  it("accepts its own signature", async () => {
    const token = await createZipToken([7, 3, 12]);
    expect(token.ids).toBe("3,7,12");
    expect(await verifyZipToken(token.ids, String(token.expiresAt), token.signature)).toEqual({
      ok: true,
      ids: [3, 7, 12],
    });
  });

  // Inti keamanannya: tanda tangan terikat pada daftar yang diperiksa plant-nya.
  it("rejects a signature moved to another list", async () => {
    const token = await createZipToken([3, 7]);
    expect(await verifyZipToken("3,7,12", String(token.expiresAt), token.signature)).toEqual({
      ok: false,
      code: "BAD_SIGNATURE",
    });
    expect(await verifyZipToken("3", String(token.expiresAt), token.signature)).toEqual({
      ok: false,
      code: "BAD_SIGNATURE",
    });
  });

  it("rejects a stretched expiry and an expired request", async () => {
    const now = Date.now();
    const token = await createZipToken([3], now);
    expect(
      await verifyZipToken(token.ids, String(token.expiresAt + 60_000), token.signature, now),
    ).toEqual({ ok: false, code: "BAD_SIGNATURE" });
    expect(
      await verifyZipToken(
        token.ids,
        String(token.expiresAt),
        token.signature,
        now + ZIP_TOKEN_TTL_MS + 1,
      ),
    ).toEqual({ ok: false, code: "EXPIRED" });
  });

  it("cannot be satisfied with a single-photo signature", async () => {
    const { createMediaToken } = await import("./media-token");
    const single = await createMediaToken(3);
    expect(await verifyZipToken("3", String(single.expiresAt), single.signature)).toEqual({
      ok: false,
      code: "BAD_SIGNATURE",
    });
  });
});

describe("planZip", () => {
  it("groups by date, then plant folder, and names the archive after the range", () => {
    const plan = planZip([
      record(3, ["Acid Plant", "2026", "10", "06", "05.00 Train 1.jpg"]),
      record(1, ["Acid Plant Trial", "2026", "10", "05", "02.00 Train 1.jpg"], { track: "trial" }),
      record(2, ["Acid Plant", "2026", "10", "05", "02.00 Train 1.jpg"]),
    ]);
    expect(plan.items.map((item) => item.path)).toEqual([
      "2026-10-05/Acid Plant Trial/02.00 Train 1.jpg",
      "2026-10-05/Acid Plant/02.00 Train 1.jpg",
      "2026-10-06/Acid Plant/05.00 Train 1.jpg",
    ]);
    expect(plan.name).toBe("foto-calcine-2026-10-05_sd_2026-10-06.zip");
  });
});

describe("streamZip", () => {
  it("archives what can be read and lists the rest inside the archive", async () => {
    const plan = planZip([
      record(1, ["Acid Plant", "2026", "10", "05", "02.00 Train 1.jpg"]),
      record(2, ["Acid Plant", "2026", "10", "05", "05.00 Train 1.jpg"]),
      record(3, ["Acid Plant", "2026", "10", "05", "08.00 Train 1.jpg"], { servable: false }),
      record(4, ["Acid Plant", "2026", "10", "05", "11.00 Train 1.jpg"], {
        filePath: "/etc/passwd",
      }),
    ]);
    const read = vi.fn(async (path: string) => {
      if (path.includes("05.00")) throw Object.assign(new Error("hilang"), { code: "ENOENT" });
      return new TextEncoder().encode("isi foto");
    });

    const files = listZip(await collect(streamZip(plan.items, root, read)));

    expect(Object.keys(files).sort()).toEqual([
      "2026-10-05/Acid Plant/02.00 Train 1.jpg",
      ZIP_FAILURE_NOTE,
    ]);
    expect(files["2026-10-05/Acid Plant/02.00 Train 1.jpg"]).toBe("isi foto");
    expect(files[ZIP_FAILURE_NOTE]).toContain("05.00 Train 1.jpg -- berkasnya tidak ada");
    expect(files[ZIP_FAILURE_NOTE]).toContain(
      "08.00 Train 1.jpg -- tidak pernah masuk folder jaringan",
    );
    expect(files[ZIP_FAILURE_NOTE]).toContain("11.00 Train 1.jpg -- path berada di luar");
    // Path di luar folder jaringan tidak pernah dibuka sama sekali.
    expect(read.mock.calls.map(([path]) => path)).not.toContain("/etc/passwd");
  });

  it("adds no note when every photo was read", async () => {
    const plan = planZip([record(1, ["Acid Plant", "2026", "10", "05", "02.00 Train 1.jpg"])]);
    const files = listZip(
      await collect(streamZip(plan.items, root, async () => new TextEncoder().encode("x"))),
    );
    expect(Object.keys(files)).toEqual(["2026-10-05/Acid Plant/02.00 Train 1.jpg"]);
  });

  it("reads one photo at a time, only when the consumer asks for more", async () => {
    const plan = planZip([
      record(1, ["Acid Plant", "2026", "10", "05", "02.00 Train 1.jpg"]),
      record(2, ["Acid Plant", "2026", "10", "05", "05.00 Train 1.jpg"]),
    ]);
    const read = vi.fn(async () => new TextEncoder().encode("x"));
    const iterator = streamZip(plan.items, root, read);
    await iterator.next();
    expect(read).toHaveBeenCalledTimes(1);
    await iterator.return(undefined);
    expect(read).toHaveBeenCalledTimes(1);
  });
});

describe("POST /media/zip", () => {
  const post = (fields: Record<string, string>) =>
    handleMediaZipRequest(
      new Request("http://localhost/media/zip", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(fields).toString(),
      }),
    );

  it("streams a real archive for a signed list", async () => {
    const dir = join(root, "Acid Plant", "2026", "10", "05");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "02.00 Train 1.jpg"), "foto asli");
    state.rows = [
      {
        id: 5,
        file_name: "02.00 Train 1.jpg",
        file_path: joinNetworkPath(root, ["Acid Plant", "2026", "10", "05", "02.00 Train 1.jpg"]),
        captured_at: "2026-10-04T18:03:00.000Z",
        file_size_bytes: 9,
        meta_plant: "Acid Plant",
        save_method: "app-network",
        capture_track: null,
        location_plant: null,
      },
    ];

    const token = await createZipToken([5]);
    const response = await post({ ids: token.ids, e: String(token.expiresAt), s: token.signature });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/zip");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="foto-calcine-2026-10-05.zip"',
    );
    const files = listZip(new Uint8Array(await response.arrayBuffer()));
    expect(files).toEqual({ "2026-10-05/Acid Plant/02.00 Train 1.jpg": "foto asli" });
  });

  it("refuses unsigned, altered and expired requests", async () => {
    const token = await createZipToken([5]);
    expect((await post({ ids: "5" })).status).toBe(403);
    expect(
      (await post({ ids: "5,6", e: String(token.expiresAt), s: token.signature })).status,
    ).toBe(403);
    const old = await createZipToken([5], Date.now() - ZIP_TOKEN_TTL_MS - 1000);
    expect((await post({ ids: old.ids, e: String(old.expiresAt), s: old.signature })).status).toBe(
      410,
    );
  });

  it("answers GET with 405 instead of an archive", async () => {
    const response = await handleMediaZipRequest(new Request("http://localhost/media/zip"));
    expect(response.status).toBe(405);
  });
});
