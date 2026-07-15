## Tujuan
Menambahkan sidebar ke aplikasi capture sehingga pengguna bisa bernavigasi antar halaman utama.

## Perubahan yang akan dilakukan

### 1. Struktur navigasi sidebar
- Buat komponen `AppSidebar` di `src/components/app-sidebar.tsx`.
- Menu sidebar:
  - **Capture** → `/`
  - **Gallery** → `/gallery`
  - **Settings** → `/settings` (opsional, jika diperlukan)
- Sidebar menggunakan shadcn/ui `Sidebar` dengan `collapsible="icon"` dan `SidebarTrigger` di header.

### 2. Layout root dengan sidebar
- Update `src/routes/__root.tsx`:
  - Bungkus aplikasi dengan `SidebarProvider`.
  - Tempatkan `AppSidebar` di samping area konten utama.
  - Tambahkan header kecil dengan `SidebarTrigger` dan judul aplikasi.
  - Pastikan area konten utama memiliki `flex-1` dan padding yang sesuai.

### 3. Pemisahan halaman Gallery
- Buat route baru `src/routes/gallery.tsx` untuk menampilkan galeri.
- Pindahkan seluruh logika dan UI galeri dari `src/routes/index.tsx` ke `src/routes/gallery.tsx`.
- Buat shared gallery store (`src/lib/gallery-store.ts`) yang menyimpan daftar capture secara persisten di IndexedDB/localStorage, sehingga data galeri tetap ada saat berpindah route atau memuat ulang aplikasi.

### 4. Penyesuaian halaman Capture
- `src/routes/index.tsx` tetap menangani kamera, preview, dan penyimpanan gambar.
- Setelah capture disimpan, tambahkan item ke shared gallery store (bukan state lokal).
- Hapus state, derived state, dan UI galeri dari `index.tsx`.

### 5. Styling dan kompatibilitas
- Gunakan token semantic Tailwind (`bg-sidebar`, `text-sidebar-foreground`, dll.).
- Terapkan perbaikan lebar sidebar untuk Tailwind v4: gunakan `w-[var(--sidebar-width)]` bukan `w-[--sidebar-width]`.
- Pastikan tidak ada hydration mismatch dengan tetap menggunakan gate `hydrated`.

## Hasil akhir
Aplikasi memiliki sidebar di sebelah kiri dengan navigasi Capture dan Gallery. Konten halaman masing-masing lebih fokus, dan galeri tetap persisten antar navigasi.