import { describe, expect, it } from "vitest";

import {
  ZipStoreWriter,
  crc32,
  zipArchiveName,
  zipDateFolder,
  zipEntryPath,
  zipTimestamp,
} from "./zip-store";

const text = (value: string) => new TextEncoder().encode(value);
const at = { year: 2026, month: 10, day: 6, hour: 14, minute: 5, second: 30 };

function join(chunks: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/** Pembaca ZIP minimal: dari penutup arsip ke direktori pusat ke isi berkas. */
function readZip(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = bytes.length - 22;
  expect(view.getUint32(end, true)).toBe(0x06054b50);
  const count = view.getUint16(end + 10, true);
  const directorySize = view.getUint32(end + 12, true);
  let cursor = view.getUint32(end + 16, true);
  expect(cursor + directorySize).toBe(end);

  const files: { name: string; data: Uint8Array; crc: number; time: number; date: number }[] = [];
  for (let index = 0; index < count; index++) {
    expect(view.getUint32(cursor, true)).toBe(0x02014b50);
    const flags = view.getUint16(cursor + 8, true);
    const method = view.getUint16(cursor + 10, true);
    const crc = view.getUint32(cursor + 16, true);
    const size = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    expect(flags & 0x0800).toBe(0x0800);
    expect(method).toBe(0);

    // Kepala lokal harus mengatakan hal yang sama dengan direktori pusat.
    expect(view.getUint32(localOffset, true)).toBe(0x04034b50);
    expect(view.getUint32(localOffset + 14, true)).toBe(crc);
    expect(view.getUint32(localOffset + 18, true)).toBe(size);
    const localName = view.getUint16(localOffset + 26, true);
    const dataStart = localOffset + 30 + localName + view.getUint16(localOffset + 28, true);
    files.push({
      name,
      data: bytes.subarray(dataStart, dataStart + size),
      crc,
      time: view.getUint16(cursor + 12, true),
      date: view.getUint16(cursor + 14, true),
    });
    cursor += 46 + nameLength + extraLength;
  }
  return files;
}

describe("crc32", () => {
  it("matches the reference values of the ZIP checksum", () => {
    expect(crc32(text(""))).toBe(0);
    expect(crc32(text("123456789"))).toBe(0xcbf43926);
    expect(crc32(text("The quick brown fox jumps over the lazy dog"))).toBe(0x414fa339);
  });
});

describe("ZipStoreWriter", () => {
  it("writes an archive whose directory, headers and contents agree", () => {
    const writer = new ZipStoreWriter();
    const chunks = [
      ...writer.file("2026-10-06/Acid Plant/02.00 Train 1.jpg", text("foto satu"), at),
      ...writer.file("2026-10-06/Acid Plant Trial/02.00 Train 1.jpg", text("foto dua"), at),
      ...writer.file("2026-10-07/Acid Plant/kosong.jpg", text(""), at),
      ...writer.finish(),
    ];
    const bytes = join(chunks);
    expect(writer.bytesWritten).toBe(bytes.length);

    const files = readZip(bytes);
    expect(files.map((file) => file.name)).toEqual([
      "2026-10-06/Acid Plant/02.00 Train 1.jpg",
      "2026-10-06/Acid Plant Trial/02.00 Train 1.jpg",
      "2026-10-07/Acid Plant/kosong.jpg",
    ]);
    expect(new TextDecoder().decode(files[0].data)).toBe("foto satu");
    expect(new TextDecoder().decode(files[1].data)).toBe("foto dua");
    for (const file of files) expect(crc32(file.data)).toBe(file.crc);
  });

  it("stores the given clock time in DOS form", () => {
    const writer = new ZipStoreWriter();
    const [file] = readZip(join([...writer.file("a.jpg", text("x"), at), ...writer.finish()]));
    expect(file.date).toBe(((2026 - 1980) << 9) | (10 << 5) | 6);
    expect(file.time).toBe((14 << 11) | (5 << 5) | 15);
  });

  it("keeps non-Latin file names readable", () => {
    const writer = new ZipStoreWriter();
    const [file] = readZip(
      join([...writer.file("2026-10-06/样品 照片.jpg", text("x"), at), ...writer.finish()]),
    );
    expect(file.name).toBe("2026-10-06/样品 照片.jpg");
  });

  it("stays a plain ZIP while everything fits in 32 bits", () => {
    const writer = new ZipStoreWriter();
    writer.file("a.jpg", text("x"), at);
    // Direktori pusat + penutup saja: tidak ada record ZIP64.
    expect(writer.finish()).toHaveLength(2);
  });

  it("switches to ZIP64 once an entry starts beyond 4 GB", () => {
    const writer = new ZipStoreWriter();
    // Isi tidak pernah dialokasikan: penulis hanya membaca panjangnya, dan
    // CRC-nya diberikan dari luar seperti yang dilakukan server.
    const huge = { length: 0x7fffffff } as unknown as Uint8Array;
    writer.file("a.bin", huge, at, 1);
    writer.file("b.bin", huge, at, 2);
    writer.file("c.bin", huge, at, 3);
    writer.file("d.jpg", text("x"), at);
    const chunks = writer.finish();

    // 4 kepala direktori + record ZIP64 + penunjuknya + penutup.
    expect(chunks).toHaveLength(7);
    const last = chunks[3];
    const view = new DataView(last.buffer);
    const nameLength = view.getUint16(28, true);
    expect(view.getUint16(6, true)).toBe(45);
    expect(view.getUint32(42, true)).toBe(0xffffffff);
    expect(view.getUint16(46 + nameLength, true)).toBe(0x0001);
    const low = view.getUint32(46 + nameLength + 4, true);
    const high = view.getUint32(46 + nameLength + 8, true);
    expect(high * 0x100000000 + low).toBe(3 * (30 + 5 + 0x7fffffff));
    // Entri yang masih di bawah 4 GB tetap berbentuk biasa.
    expect(new DataView(chunks[1].buffer).getUint16(30, true)).toBe(0);

    expect(new DataView(chunks[4].buffer).getUint32(0, true)).toBe(0x06064b50);
    expect(new DataView(chunks[5].buffer).getUint32(0, true)).toBe(0x07064b50);
    const end = new DataView(chunks[6].buffer);
    expect(end.getUint32(0, true)).toBe(0x06054b50);
    expect(end.getUint32(16, true)).toBe(0xffffffff);
  });
});

describe("archive layout for gallery downloads", () => {
  const photo = {
    id: 1,
    fileName: "02.00 Train 1.jpg",
    filePath: "/mnt/x/Acid Plant/2026/10/05/02.00 Train 1.jpg",
    capturedAt: "2026-10-04T18:03:00.000Z",
    plant: "Acid Plant",
    track: "regular" as const,
  };

  it("puts each photo under its date, then its plant folder", () => {
    const used = new Set<string>();
    expect(zipEntryPath(photo, used)).toBe("2026-10-05/Acid Plant/02.00 Train 1.jpg");
    expect(
      zipEntryPath(
        {
          ...photo,
          id: 2,
          track: "trial",
          filePath: "/mnt/x/Acid Plant Trial/2026/10/05/02.00 Train 1.jpg",
        },
        used,
      ),
    ).toBe("2026-10-05/Acid Plant Trial/02.00 Train 1.jpg");
  });

  it("takes the date from the session folder, not from the clock", () => {
    // Sesi 23.00 tanggal 5 yang diambil pukul 00.30 tanggal 6 (WITA).
    expect(
      zipDateFolder({
        filePath: "/mnt/x/Acid Plant/2026/10/05/23.00 Train 1.jpg",
        capturedAt: "2026-10-05T16:30:00.000Z",
        plant: "Acid Plant",
      }),
    ).toBe("2026-10-05");
  });

  it("falls back to the plant's local date when the path has no date folder", () => {
    // 22.30 UTC tanggal 5 sudah tanggal 6 di WITA.
    expect(
      zipDateFolder({
        filePath: "/mnt/x/Acid Plant Trial/IMG_0012.jpg",
        capturedAt: "2026-10-05T22:30:00.000Z",
        plant: "Acid Plant",
      }),
    ).toBe("2026-10-06");
    expect(zipDateFolder({ filePath: "x.jpg", capturedAt: "bukan tanggal", plant: null })).toBe(
      "tanpa-tanggal",
    );
  });

  it("numbers files that would overwrite each other", () => {
    const used = new Set<string>();
    const loose = { ...photo, filePath: "/mnt/x/Acid Plant/IMG.jpg", fileName: "IMG.jpg" };
    expect(zipEntryPath({ ...loose, id: 1 }, used)).toBe("2026-10-05/Acid Plant/IMG.jpg");
    expect(zipEntryPath({ ...loose, id: 2 }, used)).toBe("2026-10-05/Acid Plant/IMG (2).jpg");
    // Windows tidak membedakan huruf besar-kecil saat mengekstrak.
    expect(zipEntryPath({ ...loose, id: 3, fileName: "img.JPG" }, used)).toBe(
      "2026-10-05/Acid Plant/img (3).JPG",
    );
  });

  it("never lets a stored name climb out of its folder", () => {
    const used = new Set<string>();
    expect(zipEntryPath({ ...photo, fileName: "../../etc/passwd" }, used)).toBe(
      "2026-10-05/Acid Plant/.._.._etc_passwd",
    );
    expect(zipEntryPath({ ...photo, id: 9, fileName: "   " }, used)).toBe(
      "2026-10-05/Acid Plant/capture-9.jpg",
    );
    expect(zipEntryPath({ ...photo, id: 10, plant: null }, used)).toBe(
      "2026-10-05/Tanpa plant/02.00 Train 1.jpg",
    );
  });

  it("stamps entries with the plant's clock (WITA)", () => {
    expect(zipTimestamp(photo)).toEqual({
      year: 2026,
      month: 10,
      day: 5,
      hour: 2,
      minute: 3,
      second: 0,
    });
  });

  it("names the archive after the dates inside it", () => {
    expect(zipArchiveName(["2026-10-06", "2026-10-06"])).toBe("foto-calcine-2026-10-06.zip");
    expect(zipArchiveName(["2026-10-06", "2026-10-01", "tanpa-tanggal"])).toBe(
      "foto-calcine-2026-10-01_sd_2026-10-06.zip",
    );
    expect(zipArchiveName(["tanpa-tanggal"])).toBe("foto-calcine.zip");
  });
});
