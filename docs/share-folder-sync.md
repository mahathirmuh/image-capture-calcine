# Sinkronkan folder — foto yang ditaruh langsung di folder jaringan (2026-10-06)

## Masalah

Gallery membaca **registry** (`dbo.capture_records`), bukan isi folder jaringan. Setiap baris dibuat
aplikasi saat capture. Foto yang disalin orang langsung ke `NETWORK_SAVE_ROOT` tanpa lewat aplikasi
tidak punya baris, jadi tidak pernah tampil di Gallery, tidak ikut filter, dan tidak bisa diunduh
dari aplikasi.

## Cara kerja

Tombol **Sinkronkan folder** di halaman Gallery (hanya Super Admin) membuka dialog dua langkah:

1. **Periksa folder** — memindai folder jaringan dan menampilkan apa yang ditemukan. Tidak menulis
   apa pun.
2. **Daftarkan N berkas** — menulis satu baris registry untuk setiap berkas baru. Setelah itu
   fotonya berlaku seperti foto lain: tampil di Gallery, ikut filter dan akses per plant, bisa
   diunduh, dan thumbnail-nya dibuat lewat spanduk "buat thumbnail" yang sudah ada.

Pemindaian hanya **membaca** folder jaringan. Tidak ada berkas yang dipindah, diubah nama, atau
dihapus oleh sinkronisasi.

### Folder yang dibaca

Hanya folder plant yang dikelola aplikasi: `Acid Plant`, `Acid Plant Trial`, `Chloride Plant`,
`Pyrite Plant`, `Copper Cathode Plant`. Di dalamnya:

| Lokasi berkas | Dibaca? |
| --- | --- |
| `<Plant>/YYYY/MM/DD/` di dalam rentang tanggal yang dipilih | Ya |
| Langsung di `<Plant>/`, `<Plant>/YYYY/`, atau `<Plant>/YYYY/MM/` | Ya, selalu (tidak punya tanggal untuk disaring) |
| Subfolder lain (`<Plant>/Arsip/`, subfolder di dalam folder tanggal) | Tidak — disebut di laporan |
| Folder di luar folder plant | Tidak |

Rentang paling panjang 92 hari sekali pindai; bawaan dialog tujuh hari terakhir. Satu kali jalan
memproses paling banyak 300 berkas baru; kalau lebih, jalankan lagi.

Jenis berkas: JPG, JPEG, PNG, WebP. Jenis lain dilaporkan sebagai "dilewati". Berkas tersembunyi,
`Thumbs.db`, `desktop.ini`, dan `*.tmp` diabaikan tanpa dilaporkan.

### Apa yang dibaca dari path

Aplikasi menyimpan sebagai `<Plant>[ Trial]/YYYY/MM/DD/<HH.00> <Train|Bin> <n>.jpg`.

| Data | Sumber | Kalau tidak terbaca |
| --- | --- | --- |
| Plant dan jalur (reguler/trial) | Folder tingkat pertama | Berkas tidak didaftarkan |
| Tanggal sesi | Folder `YYYY/MM/DD` | Kosong |
| Sesi | Jam di awal nama: `02.00`, `2.00`, `02:00`, `0200`. Menit harus `00` | Kosong |
| Train/Bin | `Train 1`, `bin2`, `TRAIN_2` di nama berkas; disimpan dengan istilah plant-nya | Kosong |

Berkas bernama bebas (`IMG_0012.jpg`) tetap didaftarkan dengan plant-nya saja.

Waktu capture (`captured_at`) tidak diketahui untuk berkas seperti ini. Yang dicatat:

- tanggal dan sesi terbaca → awal sesi itu, waktu plant (WITA);
- hanya tanggal → waktu modifikasi berkas kalau jatuh pada tanggal foldernya, selain itu pukul
  00.00 tanggal folder;
- tidak ada keduanya → waktu modifikasi berkas.

Waktu modifikasi aslinya tetap disimpan di `metadata_json.fileModifiedAt`.

### Bentuk baris yang ditulis

- `metadata_json.source = "share-import"`; dibaca sebagai `origin: "share-import"` pada record.
- `capturedBy` dan `deviceCode` **kosong**: tidak ada yang menekan Capture. Yang mendaftarkan dicatat
  terpisah di `metadata_json.importedBy` / `importedAt`.
- `saveMethod = "app-network"`, `status = "saved"`: berkasnya memang ada di folder jaringan dan
  dilayani seperti foto jaringan lain.
- `device_id` wajib terisi di tabel, jadi diisi device yang sedang ditempatkan di plant itu. Plant
  yang belum punya device di registry dilewati dengan alasan itu.
- `checksum_sha256` kosong (menghitungnya berarti menarik seluruh berkas lewat CIFS).
- Satu baris jejak aktivitas `capture.imported` per kali jalan, bukan per berkas.

Berkas yang sama tidak pernah terdaftar dua kali: path dibandingkan tanpa membedakan huruf
besar-kecil dan arah pemisah, dan `INSERT`-nya memakai `WHERE NOT EXISTS` pada `file_path`.

## Konsekuensi

- Foto yang terdaftar **ikut dihitung** di cakupan sesi (`/sessions`, halaman Capture, mobile) kalau
  tanggal, sesi, dan Train/Bin-nya terbaca. Menaruh `08.00 Train 1.jpg` di folder tanggal hari ini
  membuat sesi 08.00 Train 1 tampak terisi.
- Setelah terdaftar, **Hapus** dan **Ubah nama** di Gallery berlaku pada berkas aslinya di folder
  jaringan.
- Di Gallery fotonya bertanda **Manual**, kolom Metode berisi "Ditambahkan manual", dan operator,
  kamera, serta Mini PC kosong.
- Berkas yang dihapus orang dari folder tidak membuat barisnya hilang. Laporan menyebutnya di
  "Tercatat tetapi berkasnya tidak ada"; barisnya dihapus manual dari Gallery.

## Kode

| Berkas | Isi |
| --- | --- |
| `src/lib/share-import.ts` | Aturan membaca path, bentuk laporan, serverFn `syncShareFolder` |
| `src/lib/server/share-scan.ts` | Membaca folder, membandingkan dengan registry, menulis baris |
| `src/lib/server/capture-admin.ts` | Penjaga Super Admin (dipakai juga oleh ubah nama dan hapus) |
| `src/components/share-sync-dialog.tsx` | Dialog di Gallery |

## Verifikasi (2026-10-06)

- 52 suite / 453 test lulus (26 baru: pembacaan path, penyaring berkas, waktu capture, rentang,
  pemindaian folder sementara, perbandingan dengan registry, bentuk metadata).
- Pratinjau (`apply: false`) dijalankan terhadap registry sungguhan dengan folder jaringan diganti
  folder sementara lokal: kueri record, device per plant, dan klasifikasi berjalan; jumlah baris
  `capture_records` sama sebelum dan sesudah (614). Pernyataan `INSERT` dikompilasi SQL Server
  dengan `SET NOEXEC ON` terhadap tabel sungguhan, tanpa dieksekusi.
- Dialog diperiksa di Chrome headless pada server dev terisolasi (tanpa database, sesi admin buatan
  lokal, jawaban serverFn diganti laporan contoh) dalam bahasa Indonesia, English, dan 中文: tidak
  ada error konsol; tombolnya tidak tampil untuk Operator dan Viewer.
- Build produksi berhasil; tidak ada modul server yang terbawa ke bundle browser.
- **Belum diverifikasi:** pemindaian folder jaringan sungguhan (mount CIFS di app server) dan
  pendaftaran berkas sungguhan — `apply` belum pernah dijalankan terhadap registry.
- `docs/openapi.yaml` ditinjau: `CaptureRecord` mendapat medan `origin`; tidak ada route baru.
  Sinkronisasi sendiri adalah serverFn halaman, bukan REST.
