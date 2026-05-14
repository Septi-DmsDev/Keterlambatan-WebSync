# Setup Apps Script Untuk Push Keterlambatan

1. Buka `https://script.google.com`.
2. Buat project baru, lalu copy isi `apps-script/Code.gs` ke editor.
3. Deploy:
   - `Deploy` -> `New deployment`
   - Type: `Web app`
   - Execute as: `Me`
   - Who has access: `Anyone`
4. Copy URL web app (`.../exec`).
5. Isi URL itu ke `window.LATE_SHEET_WEBAPP_URL` di `public/stores.config.js`.
6. Simpan dan deploy hosting:
   - `firebase deploy --only hosting`

Catatan:
- Spreadsheet tujuan sudah hardcoded di `Code.gs`:
  - ID: `18EIkDlLVAEzvXFUH9Hi2j7pGWO0yyWyZlhjHfk5RHiQ`
  - Sheet: `Sheet1`
- Kolom yang diisi: `D:G` (`Kode Job/Resi`, `Ready Stock`, `Produk`, `PJ Divisi`).
