const TARGET_SPREADSHEET_ID = "18EIkDlLVAEzvXFUH9Hi2j7pGWO0yyWyZlhjHfk5RHiQ";
const TARGET_SHEET_NAME = "05. Mei 2026";
const TZ = "Asia/Jakarta";

function doPost(e) {
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const storeName = String(payload.storeName || "").trim();
    const rows = Array.isArray(payload.rows) ? payload.rows : [];

    if (!storeName) return jsonOut({ ok: false, message: "storeName wajib diisi" });
    if (!rows.length) return jsonOut({ ok: false, message: "rows kosong" });

    const allowedDates = recentLateDateKeysJakarta();
    const allowedSet = toSet(allowedDates);
    const safeRows = rows
      .filter(isSafeRow)
      .filter((r) => {
        const isReadyRow = String(r.progress || "").trim().toUpperCase() === "BELUM DIPROSES";
        if (isReadyRow) return true;
        return allowedSet[String(r.shipDate || "").trim()];
      });

    if (!safeRows.length) {
      return jsonOut({ ok: true, appended: 0, skipped: rows.length, reason: "Tidak ada data keterlambatan untuk rentang 2 hari terakhir" });
    }

    const ss = SpreadsheetApp.openById(TARGET_SPREADSHEET_ID);
    const sh = ss.getSheetByName(TARGET_SHEET_NAME);
    if (!sh) return jsonOut({ ok: false, message: "Sheet tujuan tidak ditemukan" });

    const lastRow = sh.getLastRow();
    const existing = lastRow > 1 ? sh.getRange(2, 4, lastRow - 1, 2).getValues() : [];
    const existingKeys = new Set();
    existing.forEach((r) => {
      const kodeJob = String(r[0] || "").trim();
      const readyStock = String(r[1] || "").trim();
      const key = kodeJob ? `KJ__${kodeJob}` : readyStock ? `RS__${readyStock}` : "";
      if (key) existingKeys.add(key);
    });

    const appendRows = [];
    let skipped = 0;

    safeRows.forEach((r) => {
      const kodeJob = String(r.kodeJob || "").trim();
      const noPesanan = String(r.noPesanan || "").trim();
      const dedupKey = kodeJob ? `KJ__${kodeJob}` : `RS__${noPesanan}`;
      if (!dedupKey || existingKeys.has(dedupKey)) {
        skipped += 1;
        return;
      }
      existingKeys.add(dedupKey);

      const readyStock = kodeJob ? "" : noPesanan;
      const pjDivisi = String(r.progress || "").trim().toLowerCase() || "printing";

      // D: Kode Job/Resi, E: Ready Stock, F: Produk, G: PJ Divisi
      appendRows.push([
        kodeJob,
        readyStock,
        String(r.product || ""),
        pjDivisi
      ]);
    });

    if (appendRows.length) {
      sh.getRange(sh.getLastRow() + 1, 4, appendRows.length, 4).setValues(appendRows);
    }

    return jsonOut({ ok: true, appended: appendRows.length, skipped: skipped });
  } catch (err) {
    return jsonOut({ ok: false, message: err && err.message ? err.message : "Internal error" });
  }
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function recentLateDateKeysJakarta() {
  const now = new Date();
  const minus1 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const minus2 = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  return [
    Utilities.formatDate(minus1, TZ, "yyyy-MM-dd"),
    Utilities.formatDate(minus2, TZ, "yyyy-MM-dd")
  ];
}

function toSet(items) {
  const out = {};
  items.forEach((x) => { out[String(x)] = true; });
  return out;
}

function isSafeRow(row) {
  if (!row || typeof row !== "object") return false;
  const noPesanan = String(row.noPesanan || "").trim();
  const progress = String(row.progress || "").trim().toUpperCase();
  if (progress === "BELUM DIPROSES") return Boolean(noPesanan);
  const shipDate = String(row.shipDate || "").trim();
  return Boolean(noPesanan && shipDate);
}
