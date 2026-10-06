# Unduh massal Gallery — satu ZIP, folder per tanggal (2026-10-06)

## Yang dilihat pengguna

- Tombol **Unduh massal** di kepala halaman Gallery, untuk semua peran. Dialognya menawarkan dua
  pilihan: **Foto yang dipilih** (yang dicentang) atau **Semua hasil filter**, lalu memperlihatkan
  jumlah foto, jumlah folder tanggal, perkiraan ukuran, dan susunan isi arsip sebelum apa pun ditarik.
- Tombol **Unduh** / **Unduh pilihan** yang lama: satu foto tetap diunduh langsung; lebih dari satu
  membuka dialog yang sama. Sebelumnya tiap foto diunduh terpisah dan menumpuk di satu folder.
- Hasilnya satu berkas `foto-calcine-<tanggal>.zip` (atau `<awal>_sd_<akhir>` untuk beberapa
  tanggal), diunduh browser seperti berkas biasa — langsung ke disk, dengan kemajuan di daftar
  unduhan, dan tetap berjalan walau dialognya ditutup.

Browser tidak bisa membuat folder di komputer pengguna dari sebuah halaman web; ZIP adalah cara yang
berlaku di semua browser untuk mengirim susunan folder.

## Susunan arsip

```
foto-calcine-2026-10-05_sd_2026-10-06.zip
  2026-10-05/
    Acid Plant/
      02.00 Train 1.jpg
    Acid Plant Trial/
      02.00 Train 1.jpg
  2026-10-06/
    ...
```

- **Folder tanggal** diambil dari folder `YYYY/MM/DD` di path simpan foto — itu tanggal _sesi_, jadi
  foto sesi 23.00 yang diambil lewat tengah malam tetap bersama sesinya. Foto tanpa folder tanggal
  (berkas lepas yang didaftarkan lewat Sinkronkan folder) memakai tanggal capture menurut jam plant
  (WITA), bukan jam app server.
- **Folder plant di bawah tanggal** diperlukan karena nama berkas tidak unik dalam satu hari: jalur
  reguler dan trial sama-sama punya `02.00 Train 1.jpg`, dan tiga plant memakai `02.00 Bin 1.jpg`.
- Tabrakan yang tersisa diberi akhiran ` (2)`, ` (3)`. Karakter yang ditolak Windows diganti `_`.
- Jam berkas di dalam arsip = waktu capture menurut jam plant.
- Foto yang gagal diambil (berkasnya sudah tidak ada, masih di antrean app server, path di luar
  folder jaringan) tidak menggagalkan arsip; daftarnya ditulis ke `_tidak-terunduh.txt` di dalam arsip.

## Cara kerja

1. Dialog memanggil serverFn `createCaptureZipRequest({ recordIds })`. Di sinilah izin diputuskan,
   per record, dengan aturan yang sama seperti foto tunggal: akun aktif, plant record di dalam
   cakupan galeri akun, dan berkasnya memang di folder jaringan. Yang lolos ditandatangani sebagai
   **daftar id** (HMAC dengan `SESSION_SECRET`, berlaku 10 menit untuk _memulai_ unduhan).
2. Browser mengirim daftar dan tanda tangan itu sebagai **form POST** ke `/media/zip`, ke sebuah
   iframe tersembunyi. Form, bukan URL, karena seribu id tidak muat di baris permintaan; iframe,
   supaya halaman galeri tidak berpindah kalau server menolak. Dokumen yang ternyata termuat di
   iframe berarti penolakan, dan teksnya ditampilkan di dialog.
3. `handleMediaZipRequest` (di luar konteks TanStack, tanpa sesi) memverifikasi tanda tangan lalu
   **mengalirkan** arsipnya: satu foto dibaca dari share, ditulis ke respons, dilepas, baru foto
   berikutnya. Unduhan yang dibatalkan di browser menghentikan pembacaan share.

Arsipnya tanpa kompresi (JPEG tidak mengecil lagi). ZIP64 dipakai hanya untuk bagian yang
memerlukannya, sehingga arsip di atas 4 GB tetap sah — 600 foto terakhir di registry saja sudah
5,4 GB.

Batas: 1000 foto per arsip (sama dengan batas muat halaman Gallery).

| Berkas | Isi |
| --- | --- |
| `src/lib/zip-store.ts` | Penulis ZIP (stored + ZIP64), CRC-32, aturan nama folder dan berkas |
| `src/lib/server/media-zip.ts` | Tanda tangan daftar id, kueri record, aliran arsip, `POST /media/zip` |
| `src/lib/media-access.ts` | serverFn `createCaptureZipRequest` |
| `src/components/bulk-download-dialog.tsx` | Dialog |
| `src/server.ts` | Rute `/media/zip` (diperiksa sebelum `/media/:id`) |

`/media/zip` bukan bagian dari REST `/api/v1`; `docs/openapi.yaml` tidak berubah.

## Verifikasi (2026-10-06)

- 55 suite / 499 test lulus (26 baru: CRC-32 terhadap nilai acuan, isi arsip dibaca ulang, ZIP64,
  nama UTF-8, susunan folder, tanda tangan daftar id, catatan kegagalan, pembacaan satu-per-satu,
  `POST /media/zip` dengan berkas sungguhan di folder sementara).
- Arsip buatan penulis ini dibuka tiga alat lain: Python `zipfile` (CRC setiap entri), .NET /
  `Expand-Archive`, dan `tar` Windows (libarchive) — satu arsip kecil dengan folder bertingkat dan
  nama beraksara Tionghoa, dan satu arsip **4,7 GB** (25 entri, entri ke-22 dan seterusnya di atas
  4 GB). Semuanya terbaca utuh.
- Kueri dan susunan folder dijalankan baca-saja terhadap registry sungguhan: 600 record terakhir
  menjadi 40 folder tanggal, 600 path unik, 5,36 GB.
- Chrome headless pada server dev terisolasi (data contoh), sebagai Super Admin, Operator, dan
  Viewer, dalam tiga bahasa: dialog menampilkan hitungan yang benar; form POST sampai ke
  `/media/zip` yang sungguhan dan tanda tangannya diterima (server uji lalu menjawab 503 karena
  tidak punya folder jaringan, dan dialog menampilkan alasan itu); dengan jawaban diganti arsip
  kecil, browser memulai dan menyelesaikan unduhan dari iframe tanpa meninggalkan halaman.
- Build produksi berhasil.
- **Belum diverifikasi:** unduhan sungguhan dari folder jaringan produksi (share tidak terjangkau
  dari laptop pengembang), kecepatan dan perilaku arsip beberapa GB lewat reverse proxy produksi,
  dan Windows Explorer membuka arsip di atas 4 GB (alat yang diuji: Python, .NET, libarchive).
