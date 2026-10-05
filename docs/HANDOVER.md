# Handover Project — Capture Calcine

> Status: DRAFT — lengkapi bagian `[ISI]` dan verifikasi sebelum serah terima.
> Konteks awal disusun dari dokumentasi dan pembacaan kode pada 10 September 2026. Catatan pengujian di bawah merupakan bukti historis, bukan pengujian ulang saat template dibuat.

## 1. Identitas serah terima

| Item | Keterangan |
| --- | --- |
| Tanggal serah terima | [ISI] |
| Pihak yang menyerahkan | [ISI nama, tim, kontak] |
| Pihak yang menerima | [ISI nama, tim, kontak] |
| Pemilik produk / proses sampling | [ISI] |
| Penanggung jawab infrastruktur | [ISI] |
| Repository | [ISI URL] |
| Branch dan commit acuan | [ISI branch + full commit SHA] |
| Versi backend yang terpasang | [ISI versi/commit/image digest] |
| Versi APK yang digunakan | [ISI versi/build + lokasi artifact] |
| Periode pendampingan | [ISI tanggal mulai–akhir, kanal komunikasi] |

## 2. Ringkasan produk dan batas cakupan

Capture Calcine mendukung pengambilan foto sampling terjadwal untuk Acid Plant dan Chloride Plant. Repository berisi aplikasi web/backend serta aplikasi mobile Android khusus operator.

- Web: capture, dashboard, gallery, perangkat, pengguna, penyimpanan, pengaturan, dan activity log; akses mengikuti otorisasi aplikasi.
- Mobile: login persisten, Today Sessions, Capture, Recent Captures/Detail, My Device, dan Settings.
- Mobile tetap operator-only dan menggunakan teks antarmuka berbahasa Inggris.
- Admin dan supervisor workflow pada mobile berada di luar cakupan saat ini.

**Kebutuhan bisnis dan kriteria keberhasilan:** [ISI siapa menggunakan, kebutuhan operasional, serta hasil yang wajib tersedia].

## 3. Arsitektur dan aliran data

```text
Web (TanStack Start) ---- server functions ----+
                                             |
Mobile (React + Capacitor) ---- REST /api/v1 --+--> App backend
                                                   |-- MSSQL: akun, registry, metadata capture
                                                   |-- Edge Camera API: lease, preview, capture, job, asset
                                                   |-- Spool / network share: penyimpanan foto
                                                   +-- Thumbnail store: preview galeri
```

| Komponen | Teknologi / fungsi | Lokasi kode |
| --- | --- | --- |
| Web/backend | React, TypeScript, TanStack Start, Vite/Nitro | `src/` |
| REST API | API `/api/v1`, auth dan integrasi kamera | `src/lib/server/api-rest.ts` |
| Server entry | Routing REST, media, dan aplikasi | `src/server.ts` |
| Mobile Android | React, Vite, Capacitor | `mobile/` |
| Database | MSSQL; SQL tambahan/migrasi dalam repo | `db/mssql/` |
| Antrean foto | Spool dan penerusan ke share | `src/lib/server/capture-spool.ts` |
| Metadata capture | Penyimpanan record dan identitas operator | `src/lib/server/capture-record-write.ts` |
| Container | Build dengan Bun, runtime Node | `Dockerfile`, `docker-compose.yml` |

**Batas kepemilikan:** [ISI lokasi repository/service Edge Camera API, tim pemilik kamera, database, dan share].

## 4. Alur operasional yang harus dipahami

1. Operator login; mobile menyimpan dan memperbarui sesi melalui auth API.
2. Operator memilih Today Sessions atau membuka direct capture sesuai izin dan jadwal.
3. Sistem menentukan kamera yang aktif untuk plant; assignment kosong/ambigu memblokir koneksi.
4. Sistem memperoleh lease eksklusif dan menunggu preview berhasil sebelum mengizinkan capture.
5. Capture dijalankan sebagai job; aplikasi menunggu hasil lalu melakukan finalize/save.
6. Backend menyimpan foto dan metadata, termasuk plant, slot, sesi, perangkat, station, dan operator.
7. Operator memeriksa hasil melalui History/Detail. Keberhasilan job kamera saja belum membuktikan foto tersimpan di share dan registry.

Aturan penting:

- Akun satu plant dibatasi ke plant tersebut; akun `ALL` pada mobile membutuhkan pilihan sesi dengan plant konkret.
- Direct capture satu plant menggunakan waktu lokal perangkat: jendela dua jam mulai pukul 02, 05, 08, 11, 14, 17, 20, dan 23. Jendela 23:00 berlanjut sampai 00:59 hari berikutnya.
- Pemilihan sesi secara eksplisit mempertahankan alur recovery yang didokumentasikan; jangan menganggap pembatasannya sama dengan direct capture.
- API key digunakan untuk akses baca/inisialisasi login sesuai kontrak. Kendali kamera dan finalize membutuhkan token pengguna.
- Tinjau kontrak untuk perbedaan izin baca galeri dan izin kendali kamera.

**Skenario demo operasional:** [ISI plant, akun uji, sesi, kamera, hasil yang diharapkan, izin mengambil foto uji].

## 5. Inventaris lingkungan dan akses

Jangan menuliskan password, token, private key, atau API key di dokumen/repository. Cantumkan referensi secret di password manager perusahaan dan pihak yang menyetujui akses.

| Resource | Development | Staging / UAT | Production | Pemilik / cara memperoleh akses |
| --- | --- | --- | --- | --- |
| Repository | [ISI] | [ISI] | [ISI] | [ISI] |
| URL backend/web | [ISI] | [ISI] | [ISI] | [ISI] |
| Host / container | [ISI] | [ISI] | [ISI] | [ISI] |
| MSSQL server/database | [ISI] | [ISI] | [ISI] | [ISI] |
| Edge camera per plant | [ISI] | [ISI] | [ISI] | [ISI] |
| Network share | [ISI] | [ISI] | [ISI] | [ISI] |
| Spool dan thumbnail volume | [ISI] | [ISI] | [ISI] | [ISI] |
| CI/CD dan artifact APK | [ISI] | [ISI] | [ISI] | [ISI] |
| Secret manager | [ISI referensi] | [ISI referensi] | [ISI referensi] | [ISI] |

**Timezone perangkat, backend, dan plant:** [ISI dan konfirmasi keselarasan].

**Daftar konfigurasi:** gunakan `.env.example`, `src/lib/env.ts`, konfigurasi mobile, dan Compose sebagai referensi. Lengkapi tabel tanpa nilai rahasia.

| Nama variabel / konfigurasi | Fungsi | Wajib di lingkungan mana | Referensi nilai / pemilik |
| --- | --- | --- | --- |
| API_KEYS | Mengaktifkan API dan menyediakan kunci integrasi | [ISI] | [ISI] |
| API_ALLOWED_ORIGINS | Origin browser/mobile yang diizinkan | [ISI] | [ISI] |
| VITE_API_BASE_URL / MOBILE_API_BASE_URL / API_BASE_URL | Resolusi alamat backend mobile | [ISI pilihan yang dipakai] | [ISI] |
| VITE_API_KEY / MOBILE_API_KEY | Konfigurasi key mobile sesuai implementasi | [ISI pilihan yang dipakai] | [ISI] |
| NETWORK_SAVE_ROOT | Tujuan penyimpanan foto | [ISI] | [ISI] |
| CAPTURE_SPOOL_DIR | Antrean lokal server | [ISI] | [ISI] |
| CAPTURE_THUMBS_DIR | Penyimpanan thumbnail | [ISI] | [ISI] |
| [ISI konfigurasi database, auth, edge lainnya] | [ISI] | [ISI] | [ISI] |

## 6. Setup development

### Prasyarat

- Git, Node/npm, dan Bun bila memverifikasi build Docker/lockfile. Versi yang disepakati: [ISI].
- Android SDK dan JDK untuk APK. Dokumentasi saat ini mencatat override Java 17; konfirmasi dengan konfigurasi Android pada commit serah terima.
- Akses database/backend/edge uji yang sesuai: [ISI].
- Isi konfigurasi dari referensi secret yang disetujui sebelum menjalankan aplikasi.

### Langkah menjalankan

```sh
git clone <URL_REPOSITORY>
cd <DIREKTORI_REPOSITORY>
npm install
npm run dev
```

Web development menurut README menggunakan `http://localhost:8080`.

```sh
npm install --prefix ./mobile
npm run dev:mobile
```

**URL mobile aktual:** [ISI dari output Vite].

### Build dan pemeriksaan

```sh
npm test
npm run build
npm run build --prefix mobile
npm run dev:capacitor
```

APK debug: `mobile/android/app/build/outputs/apk/debug/app-debug.apk`.

- Shortcut Capacitor menjalankan build web mobile, sync Android, dan Gradle assembleDebug.
- Setelah dependency root berubah melalui npm, sinkronkan `bun.lock` sesuai README dan verifikasi frozen lockfile sebelum build Docker.
- `npm run db:migrate` mengubah database target. Konfirmasi target, kebutuhan migrasi, backup, dan izin perubahan sebelum menjalankannya; bukan langkah wajib setiap startup.

**Hasil praktik penerima:** [ISI tanggal, mesin, versi tools, command, hasil, kendala].

## 7. Deployment, backup, dan rollback

> Bagian ini harus dilengkapi berdasarkan lingkungan nyata; template ini belum merupakan runbook deployment yang tervalidasi.

| Tahap | Prosedur / tautan runbook | Pelaksana | Bukti berhasil |
| --- | --- | --- | --- |
| Pemeriksaan sebelum rilis | [ISI branch, commit, test, image/APK] | [ISI] | [ISI] |
| Backup database | [ISI perintah, lokasi, retensi] | [ISI] | [ISI] |
| Backup foto dan data persisten | [ISI share, spool, thumbnail, volume] | [ISI] | [ISI] |
| Migrasi bila diperlukan | [ISI urutan dan dampak] | [ISI] | [ISI] |
| Deploy backend | [ISI pipeline/perintah tervalidasi] | [ISI] | [ISI] |
| Distribusi APK | [ISI signing, kanal distribusi, versi] | [ISI] | [ISI] |
| Smoke test setelah rilis | [ISI health, login, preview, capture, save, history] | [ISI] | [ISI] |
| Rollback aplikasi | [ISI image/versi sebelumnya dan langkah] | [ISI] | [ISI] |
| Pemulihan data | [ISI restore test, kompatibilitas schema] | [ISI] | [ISI] |

**Urutan kompatibilitas:** dokumentasi mobile meminta backend dengan dukungan plant/device targeting terpasang sebelum client mobile terkait digunakan.

**Pemicu rollback dan pembuat keputusan:** [ISI].

**Target waktu pemulihan / toleransi kehilangan data:** [ISI kesepakatan operasional].

## 8. Troubleshooting dan eskalasi

| Gejala | Pemeriksaan awal | Bukti yang dikumpulkan / eskalasi |
| --- | --- | --- |
| API menjawab API_DISABLED | Periksa konfigurasi API_KEYS pada server | Status konfigurasi tanpa menyalin secret; pemilik backend |
| Kamera offline / preview gagal | Periksa assignment, jaringan, edge health, koneksi kamera | Device ID, waktu, kode error; pemilik edge |
| SESSION_CONFLICT | Periksa apakah client lain sedang menggunakan lease | Session/context dan waktu; koordinasikan dengan operator |
| Kamera untuk plant tidak ditemukan / ambigu | Periksa perangkat aktif dan assignment registry | Plant, device ID; administrator registry |
| Capture sukses tetapi gambar belum tersedia | Periksa hasil finalize, status pending/spooled, akses share, log server | Record ID, job ID, asset ID, status antrean |
| Gambar gelap | Periksa penutup lensa, pencahayaan dan exposure dengan operator | Sampel gambar dan konfigurasi; penanggung jawab kamera |
| Jadwal / tanggal foto meleset | Bandingkan timezone perangkat, backend, plant dan sesi tengah malam | Timestamp aktual dan sesi yang dipilih |
| Login / refresh gagal | Periksa akun aktif, respons auth dan konfigurasi backend mobile | Kode error dan waktu; jangan mencatat token |
| Invalid server function ID saat development | Tinjau SSR warmup RPC di vite.config.ts sesuai README | Nama RPC dan log startup |

**Lokasi log, monitoring, dan alert:** [ISI].

**Kontak dan urutan eskalasi:** [ISI operator → aplikasi → infra/edge; jam dukungan].

## 9. Status implementasi dan bukti verifikasi

| Area | Status awal berdasarkan dokumentasi | Bukti / batasan |
| --- | --- | --- |
| Mobile M0–M5 | Tercatat selesai | `mobile/docs/implementation-roadmap.md` |
| Integrasi direct capture | Pengujian integrasi 8 September mencatat 33 suites / 306 tests, build web dan mobile lulus | Bukti historis pada roadmap; jalankan ulang pada commit serah terima |
| APK Windows | Build dan verifikasi signature debug tercatat berhasil 8 September | Tidak membuktikan runtime APK fisik atau signing rilis |
| Edge camera 01 | Laporan 9 September mencatat lease, preview, capture, download dan integritas file berhasil | Gambar hampir hitam; tidak finalize ke registry/share dan bukan E2E mobile/web |
| End-to-end perangkat fisik | Masih perlu konfirmasi | APK → kamera → registry → network share → history |

**Bukti baru pada commit serah terima:**

| Tanggal / penguji | Commit / versi | Lingkungan | Skenario / command | Hasil | Tautan bukti |
| --- | --- | --- | --- | --- | --- |
| [ISI] | [ISI] | [ISI] | [ISI] | [PASS/FAIL/BLOCKED] | [ISI] |

### Pekerjaan terbuka

Prioritas dan pemilik di bawah harus disepakati saat serah terima.

| Pekerjaan | Prioritas | Pemilik | Kriteria selesai |
| --- | --- | --- | --- |
| Verifikasi E2E APK fisik dan penyimpanan akhir | [ISI] | [ISI] | Foto, station/plant/slot/operator benar pada registry/share dan terlihat di history |
| Verifikasi kualitas gambar kamera | [ISI] | [ISI] | Sampel operasional diterima pemilik proses |
| Verifikasi keselarasan timezone | [ISI] | [ISI] | Sesi normal dan lintas tengah malam tersimpan pada tanggal yang benar |
| Sinkronkan catatan spesifikasi tentang mock data | [ISI] | [ISI] | Dokumen sesuai kode dan status integrasi terbaru |
| Putuskan status perubahan lokal / file belum terlacak | [ISI] | [ISI] | Setiap perubahan dicatat dan dimasukkan ke baseline atau dipisahkan secara jelas |
| [ISI pekerjaan tambahan] | [ISI] | [ISI] | [ISI] |

Pada pembacaan awal 10 September, `docker-compose.yml` memiliki perubahan lokal dan tiga laporan `edge-camera-01` belum terlacak Git. Periksa ulang `git status --short` saat menentukan baseline; catatan ini bukan inventaris permanen.

## 10. Peta dokumentasi dan aturan perubahan

- [README](../README.md): startup, struktur repo, build dan lockfile.
- [AGENTS.md](../AGENTS.md) dan [mobile/AGENTS.md](../mobile/AGENTS.md): disiplin implementasi dan verifikasi.
- [OpenAPI](openapi.yaml): kontrak REST; cocokkan dengan implementasi saat backend berubah.
- [Roadmap mobile](../mobile/docs/implementation-roadmap.md): fase, checklist, bukti pengujian dan batasan.
- [Spesifikasi fungsional](../mobile/docs/functional-specification.md), [rencana teknis](../mobile/docs/technical-implementation-plan.md), dan [pertanyaan terbuka](../mobile/docs/open-questions-and-challenges.md).
- [CI/CD](../CI_CD.md): referensi pipeline; konfirmasi terhadap lingkungan aktual.
- [Integrasi kamera](../CAMERA_API_INTEGRATION.md) dan [preview polling](../CAMERA_PREVIEW_POLLING.md).
- [Laporan edge camera 01](edge-camera-01-functional-2026-09-09.md): hasil dan batasan pengujian terakhir yang dibaca.

Aturan kerja: baca sumber dokumentasi sebelum implementasi, review OpenAPI untuk perubahan backend, catat bukti verifikasi, dan sinkronkan roadmap/dokumen terkait. Hindari menulis ulang riwayat Git yang sudah dipublikasikan karena keterhubungan Lovable yang dicatat pada mobile/AGENTS.md.

## 11. Agenda dan checklist penerimaan

Agenda yang disarankan: 15 menit konteks/arsitektur, 20 menit demo, 30 menit praktik penerima, dan 15 menit pembahasan masalah serta tanggung jawab.

- [ ] Penerima memperoleh akses repository dan resource sesuai perannya.
- [ ] Branch, commit, versi deployment dan APK acuan dicatat.
- [ ] Perubahan lokal telah direkonsiliasi ke baseline yang jelas.
- [ ] Penerima berhasil menjalankan web dan mobile development.
- [ ] Penerima memahami izin plant, lease kamera, sesi dan finalize.
- [ ] Pemeriksaan build/test pada baseline memiliki bukti.
- [ ] Demo capture pada lingkungan yang disepakati selesai hingga hasil tersimpan dan dapat dilihat.
- [ ] Penerima dapat menemukan log dan menelusuri satu skenario gangguan.
- [ ] Prosedur deployment, backup, restore dan rollback tersedia serta status pengujiannya jelas.
- [ ] Secret diserahkan melalui kanal resmi; tidak ada nilai rahasia dalam dokumen.
- [ ] Pekerjaan terbuka memiliki pemilik, prioritas dan target waktu.
- [ ] Masa pendampingan dan kontak eskalasi disepakati.

| Persetujuan | Nama | Tanggal | Catatan / pengecualian |
| --- | --- | --- | --- |
| Pihak menyerahkan | [ISI] | [ISI] | [ISI] |
| Pihak menerima | [ISI] | [ISI] | [ISI] |
| Pemilik produk / atasan bila diperlukan | [ISI] | [ISI] | [ISI] |

**Status akhir:** [DRAFT / DITERIMA DENGAN CATATAN / DITERIMA].

**Pengecualian yang disepakati dan tanggal tindak lanjut:** [ISI].
