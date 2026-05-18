# Setup Apps Script Untuk Push Keterlambatan

## Tujuan
Menerima payload dari dashboard (`public/app.js`) lalu menambahkan data ke Google Sheet target secara dedup.

## File
- Script utama: `apps-script/Code.gs`
- Function endpoint: `doPost(e)`

## Langkah Deploy
1. Buka `https://script.google.com`.
2. Buat project baru.
3. Copy isi `apps-script/Code.gs` ke editor.
4. Deploy:
   - `Deploy` -> `New deployment`
   - Type: `Web app`
   - Execute as: `Me`
   - Who has access: `Anyone`
5. Copy URL web app yang berakhiran `/exec`.
6. Tempel URL ke `window.LATE_SHEET_WEBAPP_URL` di `public/stores.config.js`.
7. Deploy ulang hosting frontend bila perlu.

## Konfigurasi Hardcoded Saat Ini
Di `Code.gs`:
- `TARGET_SPREADSHEET_ID = 18EIkDlLVAEzvXFUH9Hi2j7pGWO0yyWyZlhjHfk5RHiQ`
- `TARGET_SHEET_NAME = 05. Mei 2026`
- Timezone: `Asia/Jakarta`

Kolom tulis:
- `D:G` = `Kode Job/Resi`, `Ready Stock`, `Produk`, `PJ Divisi`

## Format Payload
Body JSON:
```json
{
  "storeName": "Nama Toko",
  "rows": [
    {
      "kodeJob": "...",
      "noPesanan": "...",
      "product": "...",
      "progress": "...",
      "shipDate": "YYYY-MM-DD"
    }
  ]
}
```

## Aturan Validasi dan Dedup
- `storeName` wajib ada.
- `rows` wajib array dan tidak kosong.
- Untuk baris non-ready-stok, `shipDate` hanya diterima untuk tanggal H-1 atau H-2 (zona `Asia/Jakarta`).
- Dedup key:
  - Jika `kodeJob` ada -> `KJ__{kodeJob}`
  - Jika tidak -> `RS__{noPesanan}`
- Data existing dibaca dari kolom D:E mulai baris 2.

## Catatan Penting
- Jika ganti bulan, update `TARGET_SHEET_NAME` manual agar push masuk ke tab periode yang benar.
- Samakan status ready stok antara frontend dan Apps Script (`BLOM DIPROSES` vs `BELUM DIPROSES`) untuk menghindari mismatch logika filter.
