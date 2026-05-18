const SHEET_ID = "1b_8SxLQK7psTWZB0C1NBYtxXNqP1bj8REUPOeCcP9bU";
const TAB_NAMES = ["TT", "TA", "LA", "PT", "LT", "SS", "SV"];
const START_ROW = 6;
const STAGES = [
  "ACC PERTAMA",
  "DESAIN FIX",
  "PRINTING",
  "GANDENGAN / CUTTING MESIN",
  "POTONG",
  "FINISHING / CHEKER UNDANGAN",
  "CHEKER PAKET",
  "PACKING"
];

const els = {
  orderIds: document.getElementById("orderIds"),
  btnLookup: document.getElementById("btnLookup"),
  btnCopyDetected: document.getElementById("btnCopyDetected"),
  lookupStatus: document.getElementById("lookupStatus"),
  lookupSummary: document.getElementById("lookupSummary"),
  resultBody: document.getElementById("resultBody"),
  missingBox: document.getElementById("missingBox")
};
let lastFoundRows = [];

bootstrap();

function bootstrap() {
  els.btnLookup.addEventListener("click", runLookup);
  els.btnCopyDetected.addEventListener("click", copyDetectedIds);
}

async function runLookup() {
  const ids = parseIds(els.orderIds.value);
  if (!ids.length) {
    lastFoundRows = [];
    setStatus("Masukkan minimal 1 ID pesanan.");
    renderSummary(0, 0, 0);
    renderResults([]);
    renderMissing([]);
    return;
  }

  setStatus(`Proses scan ${TAB_NAMES.length} tab...`);
  els.btnLookup.disabled = true;

  try {
    const allRows = await fetchAllTabs();
    const rowMap = createRowOrderMap(allRows);
    const foundRows = ids
      .map((id) => findRowMatchFromImport(id, rowMap))
      .filter(Boolean);
    lastFoundRows = foundRows;

    const missing = ids.filter((id) => !findRowMatchFromImport(id, rowMap));

    renderResults(foundRows);
    renderMissing(missing);
    renderSummary(ids.length, foundRows.length, missing.length);
    setStatus(`Selesai. Ditemukan ${foundRows.length} baris dari ${ids.length} ID.`);
  } catch (err) {
    lastFoundRows = [];
    setStatus(`Gagal lookup: ${err.message}`);
  } finally {
    els.btnLookup.disabled = false;
  }
}

async function fetchAllTabs() {
  const jobs = TAB_NAMES.map((tabName) => fetchTabRows(tabName));
  const results = await Promise.all(jobs);
  return results.flat();
}

async function fetchTabRows(tabName) {
  const progressCols = expandRangeCols("K:Z");
  const selectCols = ["A", "B", "C", "E", "F", ...progressCols];
  const offset = START_ROW - 1;
  const query = `select ${selectCols.join(",")} offset ${offset}`;
  const baseUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tq=${encodeURIComponent(query)}&sheet=${encodeURIComponent(tabName)}`;

  const data = await fetchGvizData(baseUrl);
  const rows = data.table?.rows || [];

  return rows.map((r) => mapRow(tabName, r));
}

function mapRow(tabName, row) {
  const cells = row.c || [];
  const progressCells = cells.slice(5).map((c) => c?.v ?? "");
  const progressInfo = getLatestProgressInfo(progressCells);
  return {
    tab: tabName,
    colJob: cells[0]?.v ?? "",
    colCustomer: cells[1]?.v ?? "",
    colProduct: cells[2]?.v ?? "",
    colQty: cells[3]?.v ?? "",
    colOrder: cells[4]?.v ?? "",
    progressRange: progressInfo.stage,
    progressDate: progressInfo.date
  };
}

async function fetchGvizData(url) {
  try {
    const res = await fetch(`${url}&tqx=out:json`, { mode: "cors", credentials: "omit" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    return parseGvizResponseText(text);
  } catch (err) {
    if (err instanceof TypeError) {
      return fetchGvizJsonp(url);
    }
    throw err;
  }
}

function fetchGvizJsonp(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const cb = `__gviz_cb_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const sep = url.includes("?") ? "&" : "?";
    const script = document.createElement("script");
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Timeout mengakses Google Sheets"));
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timer);
      delete window[cb];
      script.remove();
    }

    window[cb] = (resp) => {
      cleanup();
      resolve(resp);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("Akses Google Sheets diblokir browser/jaringan"));
    };

    script.src = `${url}${sep}tqx=${encodeURIComponent(`responseHandler:${cb};out:json`)}`;
    document.head.appendChild(script);
  });
}

function parseGvizResponseText(text) {
  const start = text.indexOf("(");
  const end = text.lastIndexOf(")");
  if (start < 0 || end < 0 || end <= start) {
    throw new Error("Format respon Google Sheets tidak dikenali");
  }
  return JSON.parse(text.substring(start + 1, end));
}

function renderResults(rows) {
  els.resultBody.innerHTML = "";
  rows.forEach((r) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(r.colJob)}</td>
      <td>${escapeHtml(r.colOrder)}</td>
      <td>${escapeHtml(r.colCustomer)}</td>
      <td>${escapeHtml(r.colProduct)}</td>
      <td>${escapeHtml(r.colQty)}</td>
      <td>${escapeHtml(r.progressRange)}</td>
      <td>${escapeHtml(r.progressDate)}</td>
    `;
    els.resultBody.appendChild(tr);
  });
}

async function copyDetectedIds() {
  if (!lastFoundRows.length) {
    setStatus("Belum ada data tabel untuk disalin.");
    pulseCopyButton("Tidak ada data", "warn");
    return;
  }
  pulseCopyButton("Menyalin...", "loading");
  const lines = lastFoundRows.map((r) => [
    normalizeOrderNo(r.colJob),
    normalizeOrderNo(r.colOrder),
    normalizeOrderNo(r.colCustomer),
    normalizeOrderNo(r.colProduct),
    normalizeOrderNo(r.colQty),
    normalizeOrderNo(r.progressRange),
    normalizeOrderNo(r.progressDate)
  ].join("\t"));
  const text = lines.join("\n");
  try {
    await copyToClipboard(text);
    setStatus(`Berhasil menyalin ${lastFoundRows.length} baris data tabel.`);
    pulseCopyButton("Tersalin!", "success");
  } catch (_err) {
    setStatus("Gagal menyalin data. Coba lagi.");
    pulseCopyButton("Gagal menyalin", "warn");
  }
}

async function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  ta.remove();
}

function renderMissing(ids) {
  els.missingBox.textContent = ids.length ? ids.join("\n") : "Semua ID ditemukan.";
}

function renderSummary(inputCount, foundCount, missingCount) {
  els.lookupSummary.innerHTML = "";
  const pills = [
    `Total Input: ${inputCount}`,
    `Ditemukan: ${foundCount}`,
    `Tidak Ditemukan: ${missingCount}`,
    `Tab Discanning: ${TAB_NAMES.join(", ")}`
  ];
  pills.forEach((text) => {
    const el = document.createElement("div");
    el.className = "pill";
    el.textContent = text;
    els.lookupSummary.appendChild(el);
  });
}

function setStatus(text) {
  els.lookupStatus.textContent = text;
}

function parseIds(raw) {
  return raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeOrderNo(v) {
  return String(v ?? "").trim();
}

function normalizeOrderKey(v) {
  return String(v ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function getOrderSuffix4(orderKey) {
  if (!orderKey) return "";
  if (orderKey.length <= 4) return orderKey;
  return orderKey.slice(-4);
}

function createRowOrderMap(rows) {
  const map = new Map();
  rows.forEach((row) => {
    const key = normalizeOrderKey(row.colOrder);
    if (!key || map.has(key)) return;
    map.set(key, row);
  });
  return map;
}

function findRowMatchFromImport(importOrderNo, rowMap) {
  const fullKey = normalizeOrderKey(importOrderNo);
  if (!fullKey) return null;
  const exact = rowMap.get(fullKey);
  if (exact) return exact;
  const suffix = getOrderSuffix4(fullKey);
  if (!suffix) return null;
  return rowMap.get(suffix) || null;
}

function getLatestProgressInfo(cells) {
  // K:Z direkam sebagai pasangan kolom per tahap (mis. tanggal + W/executor).
  // Kita tampilkan nama tahap terakhir yang memiliki data + tanggal progress terakhir (DD/MM).
  let latestStage = "";
  let latestDate = "";
  for (let i = 0; i < cells.length; i += 2) {
    const left = String(cells[i] ?? "").trim();
    const right = String(cells[i + 1] ?? "").trim();
    const hasValue = left || right;
    if (hasValue) {
      const stageIndex = Math.floor(i / 2);
      latestStage = STAGES[stageIndex] || "IN PROGRESS";
      latestDate = extractDDMM(left) || extractDDMM(right) || latestDate;
    }
  }
  return {
    stage: latestStage || "-",
    date: latestDate || "-"
  };
}

function extractDDMM(text) {
  const raw = String(text ?? "").trim();
  if (!raw) return "";
  const m = raw.match(/(\d{1,2})[\/\-](\d{1,2})/);
  if (!m) return "";
  const dd = String(Number(m[1])).padStart(2, "0");
  const mm = String(Number(m[2])).padStart(2, "0");
  if (dd === "00" || mm === "00") return "";
  return `${dd}/${mm}`;
}

function expandRangeCols(range) {
  const parts = String(range).split(":").map((x) => x.trim().toUpperCase());
  if (parts.length !== 2) return [];
  const start = colToNum(parts[0]);
  const end = colToNum(parts[1]);
  if (start < 1 || end < 1 || end < start) return [];

  const cols = [];
  for (let i = start; i <= end; i += 1) cols.push(numToCol(i));
  return cols;
}

function colToNum(col) {
  let n = 0;
  for (const ch of col) {
    const code = ch.charCodeAt(0);
    if (code < 65 || code > 90) return -1;
    n = n * 26 + (code - 64);
  }
  return n;
}

function numToCol(num) {
  let n = num;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function escapeHtml(v) {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function pulseCopyButton(text, mode = "default") {
  const btn = els.btnCopyDetected;
  if (!btn) return;

  if (!btn.dataset.baseText) btn.dataset.baseText = btn.textContent;
  const baseText = btn.dataset.baseText;

  btn.textContent = text;

  if (mode === "loading") {
    btn.disabled = true;
    btn.style.opacity = "0.85";
    btn.style.cursor = "wait";
    return;
  }

  if (mode === "success") {
    btn.disabled = false;
    btn.style.opacity = "1";
    btn.style.cursor = "pointer";
    btn.style.background = "#198754";
    btn.style.color = "#ffffff";
  } else if (mode === "warn") {
    btn.disabled = false;
    btn.style.opacity = "1";
    btn.style.cursor = "pointer";
    btn.style.background = "#b55f0a";
    btn.style.color = "#ffffff";
  } else {
    btn.disabled = false;
    btn.style.opacity = "1";
    btn.style.cursor = "pointer";
    btn.style.background = "";
    btn.style.color = "";
  }

  setTimeout(() => {
    btn.textContent = baseText;
    btn.style.background = "";
    btn.style.color = "";
    btn.style.opacity = "1";
    btn.style.cursor = "pointer";
    btn.disabled = false;
  }, 1400);
}
