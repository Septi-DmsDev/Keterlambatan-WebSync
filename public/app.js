const DATE_COL = "Pesanan Harus Dikirimkan Sebelum (Menghindari keterlambatan)";
const EXCEL_ORDER_COL = "No. Pesanan";
const ACCESS_PIN = "140526";
const ACCESS_SESSION_KEY = "urgenator_pin_ok";
const READY_STOCK_SHEET_ID = "1BkMkaIiH-oQxMiLR-mtzQkN504bY84eKwbgQDJ6RmLE";
const READY_STOCK_TABS = ["PP TEKNOS", "PP DREAM/MAHAR", "PP RICH", "PP VARIATIF", "PP ASHA", "PP MALL", "PP CLASSY"];
const READY_STOCK_ORDER_COLS = ["C", "H", "M", "R", "W", "AB"];
const IMPORT_PRODUCT_COL = "O";
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

let stores = loadStoresFromConfig();
let selectedStoreId = stores[0]?.id || null;
let rowsAll = [];
let rowsFiltered = [];
let matchedRows = [];
let matchedRowsAll = [];
let excelSheetRef = null;
let orderChart;
let activeChartDate = "";

const storeList = document.getElementById("storeList");
const btnNewStore = document.getElementById("btnNewStore");
const btnSyncStore = document.getElementById("btnSyncStore");
const excelFile = document.getElementById("excelFile");
const btnApplyFilter = document.getElementById("btnApplyFilter");
const dateFrom = document.getElementById("dateFrom");
const dateTo = document.getElementById("dateTo");
const fileStatus = document.getElementById("fileStatus");
const summary = document.getElementById("summary");
const resultBody = document.getElementById("resultBody");
const readyMissingBody = document.getElementById("readyMissingBody");
const matchStatus = document.getElementById("matchStatus");
const resultSearch = document.getElementById("resultSearch");
const resultDateFrom = document.getElementById("resultDateFrom");
const resultDateTo = document.getElementById("resultDateTo");
const btnClearChartFilter = document.getElementById("btnClearChartFilter");
const btnPushLateOrders = document.getElementById("btnPushLateOrders");
const storeDialog = document.getElementById("storeDialog");
const storeForm = document.getElementById("storeForm");
const btnCancelStore = document.getElementById("btnCancelStore");
const btnDeleteStore = document.getElementById("btnDeleteStore");
const appRoot = document.getElementById("appRoot");
const loginGate = document.getElementById("loginGate");
const pinInput = document.getElementById("pinInput");
const btnLoginPin = document.getElementById("btnLoginPin");
const loginStatus = document.getElementById("loginStatus");

let editingStoreId = null;
let readyStockMissingRowsAll = [];
let readyStockMissingRows = [];

initAccessGate();

function bootstrap() {
  if (!stores.length) {
    fileStatus.textContent = "Konfigurasi toko kosong. Isi file stores.config.js";
  }

  bindEvents();
  renderStoreList();
  renderChart([]);
  if (btnClearChartFilter) btnClearChartFilter.disabled = true;
}

function initAccessGate() {
  const unlocked = sessionStorage.getItem(ACCESS_SESSION_KEY) === "1";
  if (unlocked) {
    unlockApp();
    return;
  }
  lockApp();
  if (pinInput) pinInput.focus();
  if (pinInput) {
    pinInput.addEventListener("input", () => {
      pinInput.value = String(pinInput.value || "").replace(/\D/g, "").slice(0, 6);
    });
    pinInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") verifyPin();
    });
  }
  if (btnLoginPin) btnLoginPin.addEventListener("click", verifyPin);
}

function lockApp() {
  if (appRoot) appRoot.classList.add("app-hidden");
  if (loginGate) loginGate.style.display = "grid";
}

function unlockApp() {
  if (loginGate) loginGate.style.display = "none";
  if (appRoot) appRoot.classList.remove("app-hidden");
  bootstrap();
}

function verifyPin() {
  const pin = String(pinInput?.value || "");
  if (!/^\d{6}$/.test(pin)) {
    if (loginStatus) loginStatus.textContent = "PIN harus 6 digit angka.";
    return;
  }
  if (pin !== ACCESS_PIN) {
    if (loginStatus) loginStatus.textContent = "PIN salah.";
    if (pinInput) pinInput.select();
    return;
  }
  sessionStorage.setItem(ACCESS_SESSION_KEY, "1");
  if (loginStatus) loginStatus.textContent = "";
  unlockApp();
}

function bindEvents() {
  if (btnNewStore) {
    btnNewStore.addEventListener("click", () => {
      matchStatus.textContent = "Mode hardcoded aktif. Tambah toko lewat file stores.config.js";
    });
  }
  if (btnSyncStore) btnSyncStore.addEventListener("click", syncCurrentStore);
  if (excelFile) excelFile.addEventListener("change", loadExcel);
  if (btnApplyFilter) btnApplyFilter.addEventListener("click", applyFilter);
  if (resultSearch) resultSearch.addEventListener("input", applyResultFilters);
  if (resultDateFrom) resultDateFrom.addEventListener("change", applyResultFilters);
  if (resultDateTo) resultDateTo.addEventListener("change", applyResultFilters);
  if (btnClearChartFilter) btnClearChartFilter.addEventListener("click", clearChartDateFilter);
  if (btnPushLateOrders) btnPushLateOrders.addEventListener("click", pushLateOrders);
  if (storeForm) storeForm.addEventListener("submit", (e) => e.preventDefault());
  if (btnCancelStore && storeDialog) btnCancelStore.addEventListener("click", () => storeDialog.close());
  if (btnDeleteStore && storeDialog) btnDeleteStore.addEventListener("click", () => storeDialog.close());
}

function loadStoresFromConfig() {
  const cfg = window.STORE_CONFIG;
  if (!Array.isArray(cfg)) return [];
  return cfg
    .map((s, i) => ({
      id: String(s.id || `toko-${i + 1}`),
      name: String(s.name || `Toko ${i + 1}`),
      url: String(s.url || ""),
      sheet: String(s.sheet || "Sheet1"),
      colJob: String(s.colJob || "A").toUpperCase(),
      colOrder: String(s.colOrder || "F").toUpperCase(),
      colCustomer: String(s.colCustomer || "B").toUpperCase(),
      colProduct: String(s.colProduct || "C").toUpperCase(),
      colQty: String(s.colQty || "D").toUpperCase(),
      progressRange: String(s.progressRange || "K:Z").toUpperCase(),
      startRow: Number(s.startRow || 6)
    }))
    .filter((s) => s.url);
}

function renderStoreList() {
  storeList.innerHTML = "";
  stores.forEach((store) => {
    const btn = document.createElement("button");
    btn.className = `store-item ${store.id === selectedStoreId ? "active" : ""}`;
    btn.textContent = store.name;
    btn.addEventListener("click", () => {
      selectedStoreId = store.id;
      renderStoreList();
    });
    btn.addEventListener("dblclick", () => openStoreDialog(store));
    storeList.appendChild(btn);
  });
}

async function loadExcel(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true, raw: false });
  excelSheetRef = wb.Sheets[wb.SheetNames[0]];
  rowsAll = XLSX.utils.sheet_to_json(excelSheetRef, { defval: "" });
  fileStatus.textContent = `Excel termuat: ${file.name} (${rowsAll.length} baris)`;
  applyFilter();
}

function applyFilter(preserveChartDate = false) {
  if (!preserveChartDate) {
    activeChartDate = "";
    if (btnClearChartFilter) btnClearChartFilter.disabled = true;
  }
  const from = dateFrom.value ? new Date(`${dateFrom.value}T00:00:00`) : null;
  const to = dateTo.value ? new Date(`${dateTo.value}T23:59:59`) : null;

  rowsFiltered = rowsAll.filter((row) => {
    const d = excelDateToJS(row[DATE_COL]);
    if (!d) return false;
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });

  const grouped = groupByShipDate(rowsFiltered);
  matchedRows = [];
  matchedRowsAll = [];
  readyStockMissingRowsAll = [];
  readyStockMissingRows = [];
  renderResults();
  renderReadyStockMissing();
  renderSummary(grouped);
  renderChart(grouped);
}

function groupByShipDate(rows) {
  const map = new Map();
  rows.forEach((row) => {
    const k = toDateKey(excelDateToJS(row[DATE_COL]));
    if (!k) return;
    map.set(k, (map.get(k) || 0) + 1);
  });
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function renderSummary(grouped) {
  summary.innerHTML = "";
  const total = rowsAll.length;
  const filtered = rowsFiltered.length;
  const matched = matchedRows.length;
  const pills = [
    `Total Excel: ${total}`,
    `Setelah Filter: ${filtered}`,
    `Jumlah Tanggal: ${grouped.length}`,
    `Hasil Match: ${matched}`
  ];
  pills.forEach((text) => {
    const el = document.createElement("div");
    el.className = "pill";
    el.textContent = text;
    summary.appendChild(el);
  });
}

function renderChart(grouped) {
  const labels = grouped.map((x) => x[0]);
  const values = grouped.map((x) => x[1]);
  const ctx = document.getElementById("ordersChart");

  if (orderChart) orderChart.destroy();

  orderChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Jumlah Resi/Order",
        data: values,
        borderWidth: 1,
        borderRadius: 8,
        backgroundColor: "rgba(31, 91, 196, 0.75)",
        borderColor: "rgba(31, 91, 196, 1)"
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      onClick: (_evt, elements) => {
        if (!elements.length) return;
        const idx = elements[0].index;
        const pickedDate = labels[idx] || "";
        if (!pickedDate) return;
        activeChartDate = activeChartDate === pickedDate ? "" : pickedDate;
        if (btnClearChartFilter) btnClearChartFilter.disabled = !activeChartDate;
        applyFilter(true);
      },
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 } }
      }
    }
  });
}

async function syncCurrentStore() {
  try {
    const store = stores.find((s) => s.id === selectedStoreId);
    if (!store) throw new Error("Pilih toko terlebih dulu");
    matchStatus.textContent = `Sinkron data toko ${store.name}...`;

    const sheetData = await fetchStoreRows(store);
    const mapByOrder = new Map();
    sheetData.forEach((r) => {
      const key = normalizeOrderNo(r.orderNo);
      if (key) mapByOrder.set(key, r);
    });

    matchedRowsAll = rowsFiltered
      .map((x) => {
        const order = normalizeOrderNo(x[EXCEL_ORDER_COL]);
        const found = mapByOrder.get(order);
        if (!found) return null;
        return {
          kodeJob: found.kodeJob,
          noPesanan: found.orderNo,
          customer: found.customer,
          product: found.product,
          qty: found.qty,
          progress: found.progress,
          shipDate: toDateKey(excelDateToJS(x[DATE_COL]))
        };
      })
      .filter(Boolean);

    const notMatchedRows = rowsFiltered
      .map((x) => {
        const order = normalizeOrderNo(x[EXCEL_ORDER_COL]);
        if (!order) return null;
        const found = mapByOrder.get(order);
        if (found) return null;
        return {
          noPesanan: order,
          shipDate: toDateKey(excelDateToJS(x[DATE_COL])),
          product: getImportCellValue(x, IMPORT_PRODUCT_COL)
        };
      })
      .filter(Boolean);

    // Dedup no pesanan agar tabel ready stok tidak menampilkan baris ganda.
    const uniqueNotMatchedRows = [];
    const seenNotMatchedOrders = new Set();
    notMatchedRows.forEach((r) => {
      const key = normalizeOrderNo(r.noPesanan);
      if (!key || seenNotMatchedOrders.has(key)) return;
      seenNotMatchedOrders.add(key);
      uniqueNotMatchedRows.push(r);
    });

    const readyStockOrderSet = await fetchReadyStockOrderSet();
    readyStockMissingRowsAll = uniqueNotMatchedRows.filter((r) => !readyStockOrderSet.has(normalizeOrderNo(r.noPesanan)));

    applyResultFilters();
    renderSummary(groupByShipDate(rowsFiltered));
    const dateNote = activeChartDate ? ` pada tanggal ${activeChartDate}` : "";
    matchStatus.textContent = `Sinkron selesai. Custom match ${matchedRows.length} dari ${rowsFiltered.length} order${dateNote}. Ready stok tidak ditemukan: ${readyStockMissingRows.length}.`;
  } catch (err) {
    const msg = err instanceof TypeError
      ? "Gagal koneksi ke Google Sheets (CORS/CSP/extension/network). Jalankan via http://localhost."
      : err.message;
    matchStatus.textContent = `Sinkron gagal: ${msg}`;
  }
}

async function fetchStoreRows(store) {
  const sheetId = extractSheetId(store.url);
  const gid = extractGid(store.url);
  if (!sheetId) throw new Error("URL spreadsheet toko tidak valid");

  const progressCols = expandRangeCols(store.progressRange || "K:Z");
  const selectCols = uniqueCols([store.colJob, store.colOrder, store.colCustomer, store.colProduct, store.colQty, ...progressCols]);
  const offset = Math.max(0, Number(store.startRow || 6) - 1);
  const query = `select ${selectCols.join(",")} offset ${offset}`;

  const base = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tq=${encodeURIComponent(query)}`;
  const url = gid ? `${base}&gid=${encodeURIComponent(gid)}` : `${base}&sheet=${encodeURIComponent(store.sheet || "Sheet1")}`;
  const parsed = await fetchGvizData(url);
  const rows = parsed.table?.rows || [];

  const idx = Object.fromEntries(selectCols.map((c, i) => [c.toUpperCase(), i]));
  const progressIdx = progressCols.map((c) => idx[c.toUpperCase()]);

  return rows.map((row) => {
    const cells = row.c || [];
    const rawProgress = progressIdx.map((i) => cells[i]?.v ?? "");
    return {
      kodeJob: cells[idx[store.colJob.toUpperCase()]]?.v ?? "",
      orderNo: cells[idx[store.colOrder.toUpperCase()]]?.v ?? "",
      customer: cells[idx[store.colCustomer.toUpperCase()]]?.v ?? "",
      product: cells[idx[store.colProduct.toUpperCase()]]?.v ?? "",
      qty: cells[idx[store.colQty.toUpperCase()]]?.v ?? "",
      progress: detectProgress(rawProgress)
    };
  });
}

async function fetchGvizData(url) {
  if (location.protocol === "file:") {
    return await fetchGvizJsonp(url);
  }
  try {
    const res = await fetch(`${url}&tqx=out:json`, { mode: "cors", credentials: "omit" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    return parseGvizResponseText(text);
  } catch (err) {
    if (err instanceof TypeError) {
      return await fetchGvizJsonp(url);
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

function detectProgress(progressCells) {
  if (!progressCells.length) return "BELUM MULAI";

  let stageDone = -1;
  for (let i = 0; i < progressCells.length; i += 2) {
    const hasValue = String(progressCells[i] ?? "").trim() || String(progressCells[i + 1] ?? "").trim();
    if (hasValue) stageDone = Math.floor(i / 2);
  }

  if (stageDone < 0) return "BELUM MULAI";
  return STAGES[Math.min(stageDone, STAGES.length - 1)] || "IN PROGRESS";
}

function renderResults() {
  resultBody.innerHTML = "";
  matchedRows.forEach((r) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(r.kodeJob)}</td>
      <td>${escapeHtml(r.noPesanan)}</td>
      <td>${escapeHtml(r.customer)}</td>
      <td>${escapeHtml(r.product)}</td>
      <td>${escapeHtml(r.qty)}</td>
      <td>${escapeHtml(r.shipDate)}</td>
      <td><span class="progress-tag">${escapeHtml(r.progress)}</span></td>
    `;
    resultBody.appendChild(tr);
  });
}

function renderReadyStockMissing() {
  if (!readyMissingBody) return;
  readyMissingBody.innerHTML = "";
  readyStockMissingRows.forEach((r) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(r.noPesanan)}</td>
      <td>${escapeHtml(r.product || "")}</td>
      <td>BELUM DIPROSES</td>
    `;
    readyMissingBody.appendChild(tr);
  });
}

function applyResultFilters() {
  const keyword = String(resultSearch?.value || "").trim().toLowerCase();
  const dateFrom = resultDateFrom?.value || "";
  const dateTo = resultDateTo?.value || "";
  matchedRows = matchedRowsAll.filter((row) => {
    const matchDate = !activeChartDate || row.shipDate === activeChartDate;
    if (!matchDate) return false;
    if (dateFrom && row.shipDate < dateFrom) return false;
    if (dateTo && row.shipDate > dateTo) return false;
    if (!keyword) return true;
    const haystack = [
      row.kodeJob,
      row.noPesanan,
      row.customer,
      row.product,
      row.qty,
      row.shipDate,
      row.progress
    ].join(" ").toLowerCase();
    return haystack.includes(keyword);
  });
  readyStockMissingRows = readyStockMissingRowsAll.filter((row) => {
    const matchDate = !activeChartDate || row.shipDate === activeChartDate;
    if (!matchDate) return false;
    if (dateFrom && row.shipDate < dateFrom) return false;
    if (dateTo && row.shipDate > dateTo) return false;
    if (!keyword) return true;
    const haystack = [
      row.noPesanan,
      row.shipDate,
      "ready stok tidak ditemukan"
    ].join(" ").toLowerCase();
    return haystack.includes(keyword);
  });
  renderResults();
  renderReadyStockMissing();
}

function clearChartDateFilter() {
  activeChartDate = "";
  if (btnClearChartFilter) btnClearChartFilter.disabled = true;
  renderChart(groupByShipDate(rowsFiltered));
  applyResultFilters();
}

function toJakartaDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function recentLateDateKeys() {
  const now = new Date();
  const minus1 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const minus2 = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  return [toJakartaDateKey(minus1), toJakartaDateKey(minus2)];
}

async function pushLateOrders() {
  const defaultBtnText = btnPushLateOrders ? btnPushLateOrders.textContent : "";
  try {
    const endpoint = String(window.LATE_SHEET_WEBAPP_URL || "").trim();
    if (!endpoint) throw new Error("URL Apps Script belum diisi (window.LATE_SHEET_WEBAPP_URL di stores.config.js)");

    const store = stores.find((s) => s.id === selectedStoreId);
    if (!store) throw new Error("Pilih toko terlebih dulu");
    if (!matchedRowsAll.length && !readyStockMissingRowsAll.length) {
      throw new Error("Belum ada hasil sinkron. Klik Sinkron Toko dulu.");
    }

    const allowedDates = recentLateDateKeys();
    const allowedSet = new Set(allowedDates);
    const rows = matchedRowsAll.filter((r) => {
      const noPesanan = String(r.noPesanan || "").trim();
      const shipDate = String(r.shipDate || "").trim();
      return Boolean(noPesanan) && allowedSet.has(shipDate);
    });

    // Ready stok: kirim semua baris yang tampil di tabel (tanpa filter tanggal keterlambatan).
    const readyRows = readyStockMissingRows
      .filter((r) => {
        const noPesanan = String(r.noPesanan || "").trim();
        return Boolean(noPesanan);
      })
      .map((r) => ({
        kodeJob: "",
        noPesanan: String(r.noPesanan || "").trim(),
        product: String(r.product || ""),
        progress: "BELUM DIPROSES",
        shipDate: String(r.shipDate || "").trim()
      }));

    const rowsToPush = [...rows, ...readyRows];

    if (!rowsToPush.length) {
      matchStatus.textContent = `Tidak ada data untuk dikirim.`;
      return;
    }

    if (btnPushLateOrders) {
      btnPushLateOrders.disabled = true;
      btnPushLateOrders.textContent = "Mengirim...";
    }
    matchStatus.textContent = `Mengirim ${rowsToPush.length} data (custom + ready stok)...`;

    const payload = JSON.stringify({
      storeName: store.name,
      rows: rowsToPush
    });

    let successMsg = "";
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload
      });
      let data = {};
      try {
        data = await res.json();
      } catch (_err) {
        throw new Error("Respon Apps Script tidak terbaca. Cek deploy Web App dan izin akses endpoint.");
      }
      if (!res.ok || !data.ok) {
        throw new Error(data.message || `HTTP ${res.status || "unknown"}`);
      }
      successMsg = `Push selesai. Berhasil tambah ${data.appended || 0} baris, skip ${data.skipped || 0}.`;
    } catch (err) {
      const isCorsLike = String(err?.message || "").toLowerCase().includes("failed to fetch");
      if (!isCorsLike) throw err;

      // Fallback untuk Apps Script web app yang tidak expose CORS header.
      // Request tetap terkirim, tapi browser tidak bisa membaca response detail.
      await fetch(endpoint, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: payload
      });
      successMsg = "Permintaan terkirim (mode fallback). Silakan cek sheet keterlambatan untuk konfirmasi hasil.";
    }

    matchStatus.textContent = successMsg;
    alert(successMsg);
  } catch (err) {
    const failMsg = `Push keterlambatan gagal: ${err.message}`;
    matchStatus.textContent = failMsg;
    alert(failMsg);
  } finally {
    if (btnPushLateOrders) {
      btnPushLateOrders.disabled = false;
      btnPushLateOrders.textContent = defaultBtnText || "Kirim Keterlambatan";
    }
  }
}

function openStoreDialog(store) {
  editingStoreId = store?.id || null;
  const data = store || {
    name: "",
    url: "",
    sheet: "Sheet1",
    colJob: "A",
    colOrder: "F",
    colCustomer: "B",
    colProduct: "C",
    colQty: "D",
    progressRange: "K:Z",
    startRow: 6
  };

  setValue("storeName", data.name);
  setValue("storeUrl", data.url);
  setValue("storeSheet", data.sheet);
  setValue("colJob", data.colJob);
  setValue("colOrder", data.colOrder);
  setValue("colCustomer", data.colCustomer);
  setValue("colProduct", data.colProduct);
  setValue("colQty", data.colQty);
  setValue("progressRange", data.progressRange);
  setValue("startRow", data.startRow);

  btnDeleteStore.style.visibility = store ? "visible" : "hidden";
  storeDialog.showModal();
}

function saveStoreFromDialog(e) {
  e.preventDefault();
  storeDialog.close();
}

function deleteCurrentEditingStore() {
  storeDialog.close();
}

function excelDateToJS(value) {
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date((value - 25569) * 86400 * 1000);
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function toDateKey(d) {
  if (!d) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function normalizeOrderNo(v) {
  return String(v ?? "").trim();
}

function getImportCellValue(rowObj, colLetter) {
  if (!excelSheetRef || !rowObj || typeof rowObj !== "object") return "";
  const rowNumZeroBased = rowObj.__rowNum__;
  if (!Number.isInteger(rowNumZeroBased)) return "";
  const addr = `${String(colLetter || "").toUpperCase()}${rowNumZeroBased + 1}`;
  const cell = excelSheetRef[addr];
  if (!cell) return "";
  return String(cell.w ?? cell.v ?? "").trim();
}

function extractSheetId(url) {
  const m = String(url).match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : "";
}

function extractGid(url) {
  const m = String(url).match(/[?#&]gid=(\d+)/);
  return m ? m[1] : "";
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

function uniqueCols(cols) {
  return [...new Set(cols.map((c) => c.toUpperCase()))];
}

async function fetchReadyStockOrderSet() {
  const allOrders = new Set();
  for (const tab of READY_STOCK_TABS) {
    const rows = await fetchReadyStockTabRows(tab);
    rows.forEach((orderNo) => {
      const key = normalizeOrderNo(orderNo);
      if (key) allOrders.add(key);
    });
  }
  return allOrders;
}

async function fetchReadyStockTabRows(tabName) {
  const cols = READY_STOCK_ORDER_COLS.join(",");
  const query = `select ${cols}`;
  const base = `https://docs.google.com/spreadsheets/d/${READY_STOCK_SHEET_ID}/gviz/tq?tq=${encodeURIComponent(query)}&sheet=${encodeURIComponent(tabName)}`;
  const parsed = await fetchGvizData(base);
  const rows = parsed.table?.rows || [];
  const out = [];
  rows.forEach((row) => {
    const cells = row.c || [];
    READY_STOCK_ORDER_COLS.forEach((_col, idx) => {
      const v = cells[idx]?.v;
      const key = normalizeOrderNo(v);
      if (key) out.push(key);
    });
  });
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

function setValue(id, value) {
  document.getElementById(id).value = value ?? "";
}

function getValue(id) {
  return document.getElementById(id).value.trim();
}
