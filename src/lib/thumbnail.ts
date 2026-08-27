// Thumbnail dibuat DI BROWSER OPERATOR, bukan di app server.
//
// Alasannya sederhana: pada saat capture, browser sudah memegang foto itu di
// memori. Menurunkan ukurannya di sana berbiaya seperseratus detik dan tidak
// menuntut apa pun dari server. Membuatnya di server berarti memasang pustaka
// gambar native (`sharp`, ~30 MB binary) ke dalam image Docker, lalu merawatnya
// setiap kali versi Node naik -- semua itu untuk mengulang pekerjaan yang sudah
// bisa dilakukan gratis di sisi yang lain.
//
// Yang dihemat besar: foto Canon R50 ~11 MB, thumbnail-nya ~50 KB. Satu halaman
// grid berisi 24 kartu turun dari ~264 MB jadi ~1 MB.

/** Sisi terpanjang thumbnail. 640 px masih tajam untuk menilai warna dan
 * tekstur sampel calcine di layar penuh, tapi tetap puluhan kilobyte. */
export const THUMBNAIL_MAX_EDGE = 640;

/** Mutu JPEG. 0.8 adalah titik di mana artefak belum terlihat pada foto
 * bertekstur seperti sampel calcine, sementara ukurannya sudah jauh turun. */
const THUMBNAIL_QUALITY = 0.8;

/**
 * Ukuran hasil setelah diperkecil supaya sisi terpanjangnya = `maxEdge`.
 *
 * Gambar yang sudah lebih kecil dari batas TIDAK diperbesar: memperbesar hanya
 * menambah byte tanpa menambah satu pun detail.
 *
 * Dipisah sebagai fungsi murni supaya aturannya bisa diuji tanpa canvas.
 */
export function fitWithin(
  width: number,
  height: number,
  maxEdge: number = THUMBNAIL_MAX_EDGE,
): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: 0, height: 0 };
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const scale = maxEdge / longest;
  // Dibulatkan dan minimal 1: pembulatan ke bawah pada sisi yang sangat
  // panjang dan sempit bisa menghasilkan 0, dan canvas berdimensi 0 melempar.
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function toCanvas(width: number, height: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas === "function") return new OffscreenCanvas(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

async function canvasToBlob(canvas: HTMLCanvasElement | OffscreenCanvas): Promise<Blob | null> {
  if ("convertToBlob" in canvas) {
    return canvas.convertToBlob({ type: "image/jpeg", quality: THUMBNAIL_QUALITY });
  }
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", THUMBNAIL_QUALITY);
  });
}

/**
 * Thumbnail JPEG dari sebuah foto.
 *
 * Mengembalikan `null` kalau gagal, dan itu SENGAJA tidak melempar: thumbnail
 * cuma pemercepat tampilan. Capture yang fotonya sudah tersimpan di folder
 * jaringan tidak boleh dianggap gagal hanya karena gambar kecilnya tidak
 * terbentuk.
 */
export async function createThumbnailBlob(
  source: Blob,
  maxEdge: number = THUMBNAIL_MAX_EDGE,
): Promise<Blob | null> {
  try {
    // `imageOrientation: "from-image"` menerapkan orientasi EXIF saat dekode.
    // Tanpa itu foto dari kamera yang dipasang miring akan mengecil dalam
    // posisi terputar, sementara foto aslinya tampil benar -- dan galeri jadi
    // memperlihatkan dua orientasi berbeda untuk berkas yang sama.
    const bitmap = await createImageBitmap(source, { imageOrientation: "from-image" });
    const { width, height } = fitWithin(bitmap.width, bitmap.height, maxEdge);
    if (width === 0 || height === 0) {
      bitmap.close();
      return null;
    }

    const canvas = toCanvas(width, height);
    const context = canvas.getContext("2d") as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D
      | null;
    if (!context) {
      bitmap.close();
      return null;
    }
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    return await canvasToBlob(canvas);
  } catch {
    return null;
  }
}

/** Base64 tanpa awalan data URL -- bentuk yang dikirim ke serverFn. */
export async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  // Dicicil per potongan: `String.fromCharCode(...bytes)` pada larik puluhan
  // ribu elemen melampaui batas argumen dan melempar RangeError.
  const CHUNK = 8192;
  for (let index = 0; index < bytes.length; index += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(index, index + CHUNK));
  }
  return btoa(binary);
}
