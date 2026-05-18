# URGENATOR

Dashboard web statis untuk monitoring order multi-store berbasis upload Excel + sinkronisasi Google Sheets.

## Ringkasan Fitur
- Login PIN 6 digit sebelum akses dashboard.
- Upload file Excel lalu filter rentang tanggal kirim.
- Grafik jumlah order per tanggal kirim (Chart.js) + klik batang untuk filter cepat.
- Sinkron data toko (custom), data GO, dan data Ready Stok dari Google Sheets.
- Pencocokan nomor pesanan mendukung nomor penuh atau 4 karakter alfanumerik terakhir.
- Tabel hasil sinkron:
  - Hasil pencocokan produk custom.
  - Produk GO.
  - Ready stok belum diproses.
- Push data keterlambatan ke Google Sheet tujuan via Apps Script Web App.
- Halaman terpisah untuk lookup ID pesanan lintas tab (`id-lookup.html`).

## Struktur Project
- `public/index.html`: halaman utama dashboard.
- `public/app.js`: logika utama dashboard, sinkron, filtering, dan push keterlambatan.
- `public/stores.config.js`: konfigurasi toko + endpoint Apps Script.
- `public/id-lookup.html`: halaman lookup ID pesanan.
- `public/id-lookup.js`: engine lookup lintas tab Google Sheets.
- `apps-script/Code.gs`: endpoint Apps Script untuk menerima push data.
- `apps-script/README.md`: panduan deploy Apps Script.
- `firebase.json`: konfigurasi hosting Firebase.
- `pw-smoke.js`: smoke test Playwright untuk flow sinkron.

## Arsitektur Data
1. User upload Excel di browser.
2. Aplikasi membaca Excel menggunakan `xlsx` dari CDN.
3. Aplikasi fetch data toko/GO/ready stok via Google Visualization API (`gviz/tq`) menggunakan `fetch` atau fallback JSONP.
4. Data dicocokkan berdasarkan `No. Pesanan`.
5. Hasil keterlambatan dapat dipush ke Apps Script endpoint (`doPost`).
6. Apps Script melakukan validasi, dedup, lalu append ke sheet target.

## Konfigurasi Wajib
### 1) Konfigurasi Toko
Edit `window.STORE_CONFIG` di `public/stores.config.js`.

Field per toko:
- `id`, `name`
- `url` (URL spreadsheet)
- `sheet` (nama tab)
- `colJob`, `colOrder`, `colCustomer`, `colProduct`, `colQty`
- `progressRange` (contoh `K:Z`)
- `startRow` (umumnya `6`)

### 2) Endpoint Apps Script
Isi `window.LATE_SHEET_WEBAPP_URL` di `public/stores.config.js` dengan URL deployment web app Apps Script (`.../exec`).

## Menjalankan Secara Lokal
Karena ada akses ke Google Sheets, jalankan via HTTP (jangan `file://`).

Contoh:
```powershell
npx firebase-tools serve --only hosting
```
Lalu buka URL lokal yang ditampilkan (umumnya `http://127.0.0.1:5000`).

Alternatif cepat:
```powershell
npx http-server public -p 4173
```

## Deploy
```powershell
firebase deploy --only hosting
```

## Testing
Install dependency:
```powershell
npm install
```

Jalankan smoke test (pastikan app sudah serve di `http://127.0.0.1:4173`):
```powershell
node pw-smoke.js
```

## Analisis Teknis (Temuan)
- PIN akses saat ini hardcoded di client (`ACCESS_PIN` pada `public/app.js`). Ini cocok untuk kontrol internal ringan, tapi bukan security boundary yang kuat.
- `stores.config.js` menyimpan URL spreadsheet dan endpoint Apps Script langsung di sisi client; perubahan konfigurasi membutuhkan redeploy file statis.
- `apps-script/Code.gs` masih hardcoded ke sheet target bulanan `05. Mei 2026`, sehingga pergantian bulan perlu update manual.
- Pada flow ready stok ada perbedaan string status (`BLOM DIPROSES` di frontend vs `BELUM DIPROSES` di Apps Script) yang berpotensi mempengaruhi klasifikasi baris ketika push.

## Catatan Operasional
- Pastikan semua source spreadsheet dapat diakses publik/read sesuai kebutuhan query `gviz`.
- Jika browser memblokir `fetch` CORS, kode sudah fallback JSONP.
- Jika endpoint Apps Script gagal memberi response JSON karena CORS, frontend memakai fallback `no-cors` (request terkirim, tapi hasil detail tidak bisa dibaca browser).

## Dokumentasi Tambahan
- Setup Apps Script detail: lihat `apps-script/README.md`.
