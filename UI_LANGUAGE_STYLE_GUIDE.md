# UI Language Style Guide

Panduan ini menetapkan aturan bahasa untuk UI `image capture calcine` agar istilah operasional, status runtime, dan label aksi konsisten di seluruh aplikasi.

## Tujuan

- Menjaga UI operasional mudah dipahami operator lapangan.
- Mengurangi campuran istilah Indonesia/Inggris yang membingungkan.
- Menentukan kapan istilah teknis boleh tetap memakai English.

## Prinsip Utama

1. Gunakan Bahasa Indonesia untuk copy yang dibaca operator saat bekerja.
2. Pertahankan istilah produk, nama modul, dan istilah teknis inti yang sudah mapan bila terjemahannya justru terasa janggal.
3. Pilih satu istilah utama per konsep dan gunakan terus secara konsisten.
4. Prioritaskan bahasa tindakan yang jelas, singkat, dan operasional.
5. Saat ada error atau blocker, jelaskan akar masalah lebih dulu, baru tindak lanjutnya.

## Aturan Bahasa

### Pakai Bahasa Indonesia Untuk

- Judul panel, deskripsi halaman, helper text, tooltip, toast, dan empty state.
- Label form, helper validation, petunjuk operator, dan pesan status operasional.
- Tombol aksi yang mewakili tindakan operator.

Contoh:

- `Pengaturan Simpan`
- `Tindakan Berikutnya`
- `Pilih folder`
- `Kamera tidak merespons`
- `File berikutnya akan disimpan sebagai`

### Boleh Tetap English Untuk

- Nama modul/top-level navigation yang sudah menjadi identitas aplikasi:
  - `Dashboard`
  - `Capture`
  - `Gallery`
  - `Devices`
  - `Storage`
  - `Settings`
- Istilah teknis yang umum dipakai lintas tim:
  - `Edge API`
  - `Session`
  - `Autofocus`
  - `JPEG`
  - `BIN 1`, `BIN 2`
- Nilai data atau kode sistem:
  - `Device ID`
  - `connectionState`
  - `AP / CP`
  - token filename seperti `{YYYY}`, `{LOCATION}`, `{SOURCE}`

## Aturan Penamaan

### Tombol

- Gunakan kata kerja aktif.
- Panjang ideal 1-3 kata.
- Hindari label abstrak seperti `Proceed`, `Submit`, atau `Continue` jika ada opsi lebih spesifik.

Pola yang dipakai:

- `Mulai kamera`
- `Hentikan session`
- `Hentikan tunggu`
- `Simpan BIN 1`
- `Ambil ulang BIN 2`
- `Sambungkan ulang`

### Status

- Format status sebaiknya ringkas dan mudah dipindai.
- Gunakan satu status utama, lalu detail pendukung di bawahnya.
- Jangan menampilkan dua akar masalah yang saling bertabrakan pada level prioritas yang sama.

Pola yang dipakai:

- Judul status:
  - `Menyelaraskan status kamera`
  - `Kamera USB belum terdeteksi`
  - `Menunggu kamera tersedia`
  - `Session aktif dan siap dipakai`
- Detail:
  - jelaskan kondisi saat ini
  - jelaskan tindakan operator berikutnya

### Helper Text

- Gunakan kalimat pendek.
- Tulis dalam bentuk operasional, bukan deskripsi teknis murni.
- Bila perlu, akhiri dengan tindakan yang bisa dilakukan operator.

Contoh:

- `Hubungkan kamera USB ke edge device sebelum capture atau autofocus.`
- `Jika semua jalur simpan gagal diakses, hasil capture akan diunduh lokal agar tidak hilang.`

## Glossary Resmi

Gunakan istilah berikut sebagai default:

| Konsep | Gunakan | Hindari |
| --- | --- | --- |
| Save settings | `Pengaturan Simpan` | `Save settings` |
| Action hint | `Hint tindakan` atau `Petunjuk tindakan` | `Action hint` |
| Next actions | `Tindakan Berikutnya` | `Next Actions` |
| Camera runtime | `Runtime Kamera` | `Camera Runtime` |
| Save directory | `Folder simpan` | `Save directory` |
| Filename format | `Format nama file` | `Filename format` |
| Image index | `Indeks gambar` | `Image index` |
| Discard | `Buang` | `Discard` |
| Ready to save | `Siap disimpan` | `Ready to save` |
| Waiting for preview | `Menunggu preview` | `Waiting for preview` |
| Camera is off | `Kamera belum aktif` | `Camera is off` |

Catatan:

- Untuk `Capture`, `Dashboard`, `Gallery`, `Devices`, `Storage`, `Settings`, tetap gunakan English sebagai nama modul utama.
- Untuk `Session`, gunakan `session`, bukan `sesi`, agar tetap cocok dengan istilah backend/API.

## Pola Copy Runtime

Urutan prioritas pesan runtime:

1. Bootstrap/loading
2. Edge unreachable
3. Camera disconnected
4. Session conflict / waiting
5. Session ready

Aturan:

- Jika hardware belum terbaca, jangan tonjolkan pesan `dipakai station lain` sebagai akar masalah utama.
- Jika session sedang retry, label tombol dan panel harus memakai bahasa yang sama, misalnya `Menunggu kamera tersedia` dan `Hentikan tunggu`.
- Jika sistem sedang bootstrap, jangan tampilkan state `ready` atau `offline` final terlalu cepat.

## Pola Copy Form

- Label field: Bahasa Indonesia
- Nilai teknis/data: boleh English
- Placeholder: singkat, tidak menggantikan helper text
- Helper text: menjelaskan tujuan field atau efeknya

Contoh:

- Label: `Lokasi`
- Nilai: `Chloride Plant`
- Helper: `Menentukan capture ini berasal dari plant yang mana.`

## Checklist Saat Menambah UI Baru

- Apakah judul panel memakai Bahasa Indonesia?
- Apakah tombol memakai kata kerja aktif?
- Apakah status utama hanya menunjukkan satu akar masalah?
- Apakah istilah teknis English memang perlu dipertahankan?
- Apakah helper text memberi tindakan yang bisa dilakukan operator?
- Apakah istilah yang sama dipakai konsisten dengan halaman lain?

## Scope Saat Ini

Panduan ini sudah paling relevan untuk halaman:

- `src/routes/capture.tsx`
- `src/routes/devices/index.tsx`
- `src/routes/dashboard.tsx`
- `src/routes/gallery.tsx`
- `src/routes/storage.tsx`
- `src/routes/settings.tsx`

## Rekomendasi Penggunaan

- Rujuk panduan ini saat menambah copy baru di route atau komponen UI.
- Bila perlu istilah baru, tambahkan ke bagian glossary agar konsisten untuk fitur berikutnya.
- Jangan ubah nama modul global tanpa keputusan produk terpisah.
