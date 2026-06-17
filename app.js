let rawData = [];
let filteredData = [];
let summaryStats = {};
let detectedAnomalies = {};
let filteredSalesProducts = [];
let filteredProfitProducts = [];

let chartSalesTrend,
  chartProfitTrend,
  chartSalesCategory,
  chartMarginCategory,
  chartProfitTerritory,
  chartScatter;

let activeTab = "ai";
let sidebarCollapsed = false;
let salesTablePage = 1;
let profitTablePage = 1;
const itemsPerPage = 5;
let currentSalesSort = { column: "sales", direction: "desc" };
let currentProfitSort = { column: "profit", direction: "desc" };

const monthNames = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];
const colorPalette = [
  "#2563EB",
  "#F59E0B",
  "#10B981",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
  "#F97316",
];

function parseNum(str) {
  if (!str) return 0;
  let cleaned = str.replace(/\./g, "").replace(",", ".");
  return parseFloat(cleaned);
}

function parseDate(str) {
  if (!str) return new Date();
  const cleanStr = str.split(" ")[0];
  const parts = cleanStr.split("/");
  if (parts.length === 3) {
    return new Date(
      parseInt(parts[2]),
      parseInt(parts[1]) - 1,
      parseInt(parts[0]),
    );
  }
  return new Date(str);
}

function formatCurrency(val) {
  if (val < 0)
    return (
      "-$" +
      Math.abs(val).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  return (
    "$" +
    val.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function formatShortNumber(val) {
  if (val >= 1000000) return (val / 1000000).toFixed(1) + "M";
  if (val >= 1000) return (val / 1000).toFixed(0) + "K";
  if (val <= -1000) return (val / 1000).toFixed(0) + "K";
  return val.toFixed(0);
}

window.addEventListener("DOMContentLoaded", () => {
  if (typeof lucide !== "undefined") lucide.createIcons();
  d3.dsv(";", "Sales_BY_Category_202606040914-1.csv")
    .then(function (data) {
      rawData = data
        .map((d) => ({
          orderDate: parseDate(d["OrderDate"]),
          category: d["Category"],
          subcat: d["SubCategory"],
          segment: d["Segment"],
          territory: d["Territory"],
          countryRegion: d["CountryRegion"],
          sales: parseNum(d["Sales"]),
          profit: parseNum(d["Profit"]),
          quantity: parseInt(d["Qty"]) || 0,
          productName: d["ProductName"],
        }))
        .filter((d) => !isNaN(d.sales) && !isNaN(d.orderDate.getTime()));

      if (rawData.length === 0) {
        showTemporaryBanner("Error: Data kosong — periksa format CSV.");
        return;
      }

      populateAllFilters();
      updateDashboard();
    })
    .catch((err) => {
      console.error("Gagal memuat dataset:", err);
      showTemporaryBanner("Error: Gagal memuat file CSV.");
    });
});

// filter
function populateAllFilters() {
  if (!rawData || rawData.length === 0) return;

  const yearEl = document.getElementById("filter-year");
  const segmentEl = document.getElementById("filter-segment");
  const territoryEl = document.getElementById("filter-territory");
  const categoryEl = document.getElementById("filter-category");

  const years = [
    ...new Set(rawData.map((d) => d.orderDate.getFullYear())),
  ].sort();
  yearEl.innerHTML = '<option value="all">Semua Tahun</option>';
  years.forEach((y) => {
    yearEl.innerHTML += '<option value="' + y + '">' + y + "</option>";
  });

  const segments = [
    ...new Set(rawData.filter((d) => d.segment).map((d) => d.segment)),
  ].sort();
  segmentEl.innerHTML = '<option value="all">Semua Segment</option>';
  segments.forEach((s) => {
    segmentEl.innerHTML += '<option value="' + s + '">' + s + "</option>";
  });

  const territories = [
    ...new Set(rawData.filter((d) => d.territory).map((d) => d.territory)),
  ].sort();
  territoryEl.innerHTML = '<option value="all">Semua Territory</option>';
  territories.forEach((t) => {
    territoryEl.innerHTML += '<option value="' + t + '">' + t + "</option>";
  });

  const categories = [
    ...new Set(rawData.filter((d) => d.category).map((d) => d.category)),
  ].sort();
  categoryEl.innerHTML = '<option value="all">Semua Category</option>';
  categories.forEach((c) => {
    categoryEl.innerHTML += '<option value="' + c + '">' + c + "</option>";
  });

  populateSubcategories();
}

function populateSubcategories() {
  const catFilterEl = document.getElementById("filter-category");
  const subFilter = document.getElementById("filter-subcategory");
  if (!subFilter) return;
  const selectedCat = catFilterEl ? catFilterEl.value : "all";
  subFilter.innerHTML = '<option value="all">Semua Sub-Category</option>';
  if (!rawData || rawData.length === 0) return;

  const subs = [
    ...new Set(
      rawData
        .filter(
          (d) =>
            d.subcat && (selectedCat === "all" || d.category === selectedCat),
        )
        .map((d) => d.subcat),
    ),
  ].sort();
  subs.forEach((sub) => {
    const opt = document.createElement("option");
    opt.value = sub;
    opt.innerText = sub;
    subFilter.appendChild(opt);
  });
}

function onCategoryChange() {
  populateSubcategories();
  updateDashboard();
  if (isSmallScreen()) collapseSidebar();
}
function onFilterChange() {
  updateDashboard();
  if (isSmallScreen()) collapseSidebar();
}
function applyFilters() {
  updateDashboard();
  showTemporaryBanner("Filter diterapkan.");
}

function resetFilters() {
  document.getElementById("filter-year").value = "all";
  document.getElementById("filter-quarter").value = "all";
  document.getElementById("filter-segment").value = "all";
  document.getElementById("filter-territory").value = "all";
  document.getElementById("filter-category").value = "all";
  populateSubcategories();
  const subEl = document.getElementById("filter-subcategory");
  if (subEl) subEl.value = "all";
  updateDashboard();
}

function getFilteredData() {
  const year = document.getElementById("filter-year").value;
  const quarter = document.getElementById("filter-quarter").value;
  const segment = document.getElementById("filter-segment").value;
  const territory = document.getElementById("filter-territory").value;
  const category = document.getElementById("filter-category").value;
  const subcategory = document.getElementById("filter-subcategory").value;

  let filtered = [...rawData];
  if (year !== "all")
    filtered = filtered.filter(
      (d) => d.orderDate.getFullYear() === parseInt(year),
    );
  if (quarter === "q1")
    filtered = filtered.filter(
      (d) => d.orderDate.getMonth() >= 0 && d.orderDate.getMonth() <= 2,
    );
  else if (quarter === "q2")
    filtered = filtered.filter(
      (d) => d.orderDate.getMonth() >= 3 && d.orderDate.getMonth() <= 5,
    );
  else if (quarter === "q3")
    filtered = filtered.filter(
      (d) => d.orderDate.getMonth() >= 6 && d.orderDate.getMonth() <= 8,
    );
  else if (quarter === "q4")
    filtered = filtered.filter(
      (d) => d.orderDate.getMonth() >= 9 && d.orderDate.getMonth() <= 11,
    );
  if (segment !== "all")
    filtered = filtered.filter((d) => d.segment === segment);
  if (territory !== "all")
    filtered = filtered.filter((d) => d.territory === territory);
  if (category !== "all")
    filtered = filtered.filter((d) => d.category === category);
  if (subcategory !== "all")
    filtered = filtered.filter((d) => d.subcat === subcategory);
  return filtered;
}

// Compute Summary
function computeSummary(data) {
  const totalSales = d3.sum(data, (d) => d.sales);
  const totalProfit = d3.sum(data, (d) => d.profit);
  const margin =
    totalSales > 0 ? ((totalProfit / totalSales) * 100).toFixed(1) : "0";

  const byCategory = d3.rollup(
    data,
    (v) => ({
      sales: d3.sum(v, (d) => d.sales),
      profit: d3.sum(v, (d) => d.profit),
    }),
    (d) => d.category,
  );
  const catArray = [...byCategory.entries()]
    .map(([cat, v]) => ({
      category: cat,
      sales: v.sales,
      profit: v.profit,
      margin: v.sales > 0 ? ((v.profit / v.sales) * 100).toFixed(1) : "0",
    }))
    .sort((a, b) => parseFloat(b.margin) - parseFloat(a.margin));

  const byRegion = d3.rollup(
    data,
    (v) => d3.sum(v, (d) => d.sales),
    (d) => d.territory,
  );
  const regionArray = [...byRegion.entries()]
    .map(([r, s]) => ({ region: r, sales: s }))
    .sort((a, b) => b.sales - a.sales);

  const bySegment = d3.rollup(
    data,
    (v) => ({
      sales: d3.sum(v, (d) => d.sales),
      profit: d3.sum(v, (d) => d.profit),
    }),
    (d) => d.segment,
  );
  const segmentArray = [...bySegment.entries()]
    .map(([seg, v]) => ({
      segment: seg,
      margin: v.sales > 0 ? ((v.profit / v.sales) * 100).toFixed(1) : "0",
    }))
    .sort((a, b) => parseFloat(b.margin) - parseFloat(a.margin));

  return {
    totalSales: totalSales.toFixed(2),
    totalProfit: totalProfit.toFixed(2),
    overallMargin: margin,
    totalOrders: data.length,
    categories: catArray,
    regions: regionArray,
    bestCategory: catArray[0] || { category: "N/A", margin: "0" },
    worstCategory: catArray[catArray.length - 1] || {
      category: "N/A",
      margin: "0",
    },
    bestSegment: segmentArray[0] || { segment: "N/A", margin: "0" },
  };
}

// Update Dashboard
function updateDashboard() {
  filteredData = getFilteredData();
  summaryStats = computeSummary(filteredData);
  detectedAnomalies = detectAllAnomalies(filteredData);
  renderKPIs(summaryStats);
  updateNarrative(summaryStats);
  renderAnomalyCards(detectedAnomalies);
  renderRecommendations(summaryStats, detectedAnomalies);
  renderChartsWorkspace(filteredData);
  updateProductTables();
  loadAIStory();
}

// AI Story Loading (async, non-blocking)
async function loadAIStory() {
  try {
    const [titleR, storyR] = await Promise.allSettled([
      generateTitle(summaryStats, detectedAnomalies),
      generateStory(summaryStats, detectedAnomalies),
    ]);

    if (titleR.status === "fulfilled" && titleR.value) {
      const headlineEl = document.getElementById("narrative-headline");
      if (headlineEl) {
        headlineEl.innerText = titleR.value.trim();
        headlineEl.classList.add("ai-loaded");
      }
    }

    if (storyR.status === "fulfilled" && storyR.value) {
      const scr = parseStoryResponse(storyR.value);
      if (scr.setup) {
        const el = document.getElementById("insight-key");
        if (el) el.textContent = scr.setup;
      }
      if (scr.conflict) {
        const el = document.getElementById("insight-root");
        if (el) el.textContent = scr.conflict;
      }
      if (scr.resolution) {
        const el = document.getElementById("insight-opp");
        if (el) el.textContent = scr.resolution;
      }
      const keyMetric = document.getElementById("insight-key-metric");
      if (keyMetric)
        keyMetric.textContent =
          "$" + (+summaryStats.totalSales / 1000).toFixed(0) + "K Sales";
      const rootMetric = document.getElementById("insight-root-metric");
      if (rootMetric)
        rootMetric.textContent = summaryStats.overallMargin + "% Margin";
      const oppMetric = document.getElementById("insight-opp-metric");
      if (oppMetric)
        oppMetric.textContent = summaryStats.bestCategory?.category || "N/A";
    }

  } catch (e) {
    console.warn("AI story error:", e);
  }
}

// Narrative (static fallback + AI enhanced)
function updateNarrative(stats) {
  const headlineEl = document.getElementById("narrative-headline");
  const summaryEl = document.getElementById("narrative-summary");
  if (!headlineEl || !summaryEl) return;

  if (!stats || stats.totalOrders === 0) {
    headlineEl.innerText = "Tidak Ada Data untuk Filter yang Dipilih";
    summaryEl.innerText = "Silakan sesuaikan kriteria filter Anda.";
    return;
  }

  // Fallback statis
  const margin = parseFloat(stats.overallMargin);
  let headline = headlineEl.innerText;
  if (!headlineEl.classList.contains("ai-loaded")) {
    if (margin < 5)
      headline = "Peringatan: Profit Margin Mengalami Tekanan Berat";
    else if (margin < 15)
      headline = "Sales Aktif, Namun Margin Membutuhkan Optimasi";
    else headline = "Performa Profitabilitas Kuat di Seluruh Segment";
    headlineEl.innerText = headline;
  }

  const bestCat = stats.bestCategory?.category || "N/A";
  const worstCat = stats.worstCategory?.category || "N/A";
  const topRegion = stats.regions?.[0]?.region || "N/A";

  let summaryText =
    "Total Sales sebesar " +
    formatCurrency(parseFloat(stats.totalSales)) +
    " dari " +
    stats.totalOrders.toLocaleString() +
    " transaksi. ";
  summaryText += "Profit margin keseluruhan: " + stats.overallMargin + "%. ";
  if (bestCat !== worstCat && bestCat !== "N/A")
    summaryText +=
      bestCat +
      " memimpin margin tertinggi, sementara " +
      worstCat +
      " menunjukkan profitabilitas terlemah. ";
  if (topRegion !== "N/A")
    summaryText += topRegion + " mendorong volume sales terbesar. ";
  if (margin < 10)
    summaryText +=
      "Tindakan segera disarankan untuk mengevaluasi struktur biaya pada segment yang underperforming.";
  else
    summaryText +=
      "Performa keseluruhan sehat, pemantauan berkelanjutan disarankan.";

  summaryEl.innerText = summaryText;

  // Deterministic fallback insights (shown immediately, replaced by AI if available)
  try {
    const fb = generateFallbackInsights(stats, detectedAnomalies || {});
    const keyEl = document.getElementById("insight-key");
    const rootEl = document.getElementById("insight-root");
    const oppEl = document.getElementById("insight-opp");
    const riskEl = document.getElementById("insight-risk");
    if (keyEl) keyEl.textContent = fb.setup;
    if (rootEl) rootEl.textContent = fb.conflict;
    if (oppEl) oppEl.textContent = fb.resolution;
    if (riskEl) riskEl.textContent = fb.risk;

    const keyMetric = document.getElementById("insight-key-metric");
    if (keyMetric) keyMetric.textContent = fb.metrics.key;
    const rootMetric = document.getElementById("insight-root-metric");
    if (rootMetric) rootMetric.textContent = fb.metrics.root;
    const oppMetric = document.getElementById("insight-opp-metric");
    if (oppMetric) oppMetric.textContent = fb.metrics.opp;
    const riskMetric = document.getElementById("insight-risk-metric");
    if (riskMetric) riskMetric.textContent = fb.metrics.risk;
  } catch (e) {
    console.warn("Fallback insight generation failed", e);
  }
}

// Generate a simple deterministic SCR insight from stats & anomalies
function generateFallbackInsights(stats, anomalies) {
  if (!stats || stats.totalOrders === 0) {
    return {
      setup: "Tidak ada data untuk filter saat ini.",
      conflict: "Tidak ada data untuk dianalisis.",
      resolution: "Silakan sesuaikan filter untuk melihat insight.",
      risk: "-",
      metrics: { key: "-", root: "-", opp: "-", risk: "-" },
    };
  }
  const totalSales = parseFloat(stats.totalSales) || 0;
  const totalProfit = parseFloat(stats.totalProfit) || 0;
  const margin = parseFloat(stats.overallMargin) || 0;
  const bestCat = stats.bestCategory?.category || "N/A";
  const worstCat = stats.worstCategory?.category || "N/A";

  const setup = `Total Sales ${formatCurrency(totalSales)} dengan margin ${margin}%. Transaksi: ${stats.totalOrders}.`;
  let conflict = "Tidak ada anomali signifikan terdeteksi.";
  const profitOutliers = (anomalies.profitOutliers || []).filter(
    (a) => parseFloat(a.margin) < 5,
  );
  if (profitOutliers.length > 0) {
    conflict = `Margin sangat rendah pada ${profitOutliers[0].name} (${profitOutliers[0].margin}%).`;
  } else if ((anomalies.momSpikes || []).length > 0) {
    const s = anomalies.momSpikes[0];
    conflict = `Perubahan pendapatan MoM: ${s.month} ${s.changePct}% (${s.direction || "spike"}).`;
  } else if (margin < 8) {
    conflict = "Margin agregat rendah; potensi isu profitabilitas.";
  }

  const resolution =
    margin < 10
      ? `Tinjau harga & diskon pada kategori ${worstCat} dan prioritaskan pengurangan biaya.`
      : `Pertahankan strategi penjualan pada ${bestCat} dan monitor diskon.`;

  const risk =
    (anomalies.profitOutliers || []).length > 0
      ? `${(anomalies.profitOutliers || []).length} outlier margin`
      : "—";

  return {
    setup,
    conflict,
    resolution,
    risk,
    metrics: {
      key: "$" + (totalSales / 1000).toFixed(0) + "K",
      root: margin + "%",
      opp: bestCat || "N/A",
      risk: risk,
    },
  };
}

// Render KPI
function renderKPIs(stats) {
  const safeSetText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
  };

  safeSetText("kpi-sales", formatCurrency(parseFloat(stats.totalSales)));
  safeSetText("kpi-profit", formatCurrency(parseFloat(stats.totalProfit)));
  safeSetText("kpi-margin", stats.overallMargin + "%");

  const qty = d3.sum(filteredData, (d) => d.quantity);
  safeSetText("kpi-quantity", qty.toLocaleString());
  safeSetText("kpi-orders", filteredData.length.toLocaleString());

  // Sparklines + compute month-over-month changes
  const monthlyAgg = Array(12)
    .fill(0)
    .map(() => ({ sales: 0, profit: 0, qty: 0, orders: 0 }));
  filteredData.forEach((d) => {
    monthlyAgg[d.orderDate.getMonth()].sales += d.sales;
    monthlyAgg[d.orderDate.getMonth()].profit += d.profit;
    monthlyAgg[d.orderDate.getMonth()].qty += d.quantity;
    monthlyAgg[d.orderDate.getMonth()].orders += 1;
  });
  const monthsFiltered = getFilteredMonthsList();
  const salesData = monthsFiltered.map((m) => monthlyAgg[m].sales);
  const profitData = monthsFiltered.map((m) => monthlyAgg[m].profit);
  const qtyData = monthsFiltered.map((m) => monthlyAgg[m].qty);
  const ordersData = monthsFiltered.map((m) => monthlyAgg[m].orders);
  const marginData = monthsFiltered.map((m) =>
    monthlyAgg[m].sales > 0
      ? (monthlyAgg[m].profit / monthlyAgg[m].sales) * 100
      : 0,
  );

  createSparkline("sparkline-sales", salesData, "#2563EB");
  createSparkline("sparkline-profit", profitData, "#16A34A");
  createSparkline(
    "sparkline-margin",
    marginData,
    parseFloat(stats.overallMargin) < 10 ? "#DC2626" : "#16A34A",
  );
  createSparkline("sparkline-quantity", qtyData, "#6B7280");
  createSparkline("sparkline-orders", ordersData, "#4B5563");

  // Helper: percent change (prev -> curr)
  const pctChange = (prev, curr) => {
    if (prev === 0) return curr === 0 ? 0 : 100;
    return ((curr - prev) / Math.abs(prev)) * 100;
  };

  const computeMoM = (arr) => {
    if (!arr || arr.length === 0) return 0;
    const len = arr.length;
    const curr = arr[len - 1];
    const prev = len > 1 ? arr[len - 2] : 0;
    return pctChange(prev, curr);
  };

  const formatChange = (pct) => {
    if (pct === null || typeof pct === "undefined") return "—";
    const sign = pct > 0 ? "+" : "";
    return sign + pct.toFixed(1) + "%";
  };

  const setChangeEl = (id, pct) => {
    const el = document.getElementById(id);
    if (!el) return;
    const txt = formatChange(pct);
    if (pct > 0) {
      el.className = "kpi-change up";
      el.innerHTML = '<i data-lucide="arrow-up-right"></i> ' + txt;
    } else if (pct < 0) {
      el.className = "kpi-change down";
      el.innerHTML = '<i data-lucide="arrow-down-right"></i> ' + txt;
    } else {
      el.className = "kpi-change neutral";
      el.innerHTML = '<i data-lucide="minus"></i> ' + txt;
    }
  };

  setChangeEl("kpi-sales-change", computeMoM(salesData));
  setChangeEl("kpi-profit-change", computeMoM(profitData));
  setChangeEl("kpi-quantity-change", computeMoM(qtyData));
  setChangeEl("kpi-orders-change", computeMoM(ordersData));
  setChangeEl("kpi-margin-change", computeMoM(marginData));

  if (typeof lucide !== "undefined") lucide.createIcons();

  safeSetText(
    "model-badge",
    CONFIG.AI_PROVIDER === "groq" ? CONFIG.GROQ_MODEL : CONFIG.OLLAMA_MODEL,
  );

  // Overview card stats
  if (stats.regions && stats.regions.length > 0)
    safeSetText("stat-top-territory", stats.regions[0].region);
  else safeSetText("stat-top-territory", "N/A");

  if (stats.bestCategory && stats.bestCategory.category !== "N/A")
    safeSetText(
      "stat-top-category",
      stats.bestCategory.category + " (" + stats.bestCategory.margin + "%)",
    );
  else safeSetText("stat-top-category", "N/A");

  if (stats.bestSegment && stats.bestSegment.segment !== "N/A")
    safeSetText(
      "stat-top-segment",
      stats.bestSegment.segment + " (" + stats.bestSegment.margin + "%)",
    );
  else safeSetText("stat-top-segment", "N/A");
}

function getFilteredMonthsList() {
  const quarter = document.getElementById("filter-quarter")
    ? document.getElementById("filter-quarter").value
    : "all";
  if (quarter === "q1") return [0, 1, 2];
  if (quarter === "q2") return [3, 4, 5];
  if (quarter === "q3") return [6, 7, 8];
  if (quarter === "q4") return [9, 10, 11];
  return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
}

function createSparkline(canvasId, data, color) {
  const canvasEl = document.getElementById(canvasId);
  if (!canvasEl) return;
  const cssHeight = 30;
  canvasEl.style.height = cssHeight + "px";
  const dpr = window.devicePixelRatio || 1;
  canvasEl.width = Math.max(120, Math.round(canvasEl.clientWidth * dpr));
  canvasEl.height = Math.round(cssHeight * dpr);
  const ctx = canvasEl.getContext && canvasEl.getContext("2d");
  if (!ctx) return;
  const existing = Chart.getChart(canvasId);
  if (existing) existing.destroy();
  new Chart(ctx, {
    type: "line",
    data: {
      labels: data.map((_, i) => i),
      datasets: [
        {
          data,
          borderColor: color,
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: false,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: { x: { display: false }, y: { display: false } },
    },
  });
}

// Anomaly Card
function renderAnomalyCards(anom) {
  const grid = document.getElementById("anomaly-alerts-grid");
  if (!grid) return;
  grid.innerHTML = "";
  const cardList = [];

  (anom.profitOutliers || []).forEach((o) => {
    if (parseFloat(o.margin) < 5)
      cardList.push({
        severity: o.severity,
        title: o.name + " Margin " + o.margin + "% (Outlier)",
        insight:
          "Z-Score (" +
          o.zScore +
          ") mendeteksi performa margin sub-category ini sangat di bawah rata-rata.",
        recommendation:
          "Evaluasi markup harga produk " +
          o.name +
          " dan batasi diskon transaksi.",
      });
  });

  (anom.momSpikes || []).forEach((s) => {
    if (s.direction === "drop")
      cardList.push({
        severity: s.severity,
        title: "Penurunan Sales " + s.changePct + "% — " + s.month,
        insight:
          "Sales turun drastis dari $" +
          parseFloat(s.previous).toLocaleString() +
          " ke $" +
          parseFloat(s.current).toLocaleString() +
          ".",
        recommendation:
          "Analisis hambatan pasokan atau aktivitas kompetitor pada periode tersebut.",
      });
  });

  if (anom.salesOutliersIQR && anom.salesOutliersIQR.totalOutliers > 0) {
    const topOutlier = anom.salesOutliersIQR.subcatOutliers?.[0];
    if (topOutlier)
      cardList.push({
        severity: "info",
        title:
          "Outlier Transaksi (" +
          anom.salesOutliersIQR.totalOutliers +
          " Unit)",
        insight:
          "IQR mendeteksi transaksi ekstrem. Sub-category terbanyak: " +
          topOutlier.subcat +
          " (" +
          topOutlier.count +
          " transaksi).",
        recommendation:
          "Pastikan transaksi bervolume besar mendapat penanganan prioritas.",
      });
  }

  if (cardList.length === 0) {
    grid.innerHTML =
      '<div style="grid-column: span 3; text-align: center; padding: 32px; color: var(--gray-400);"><span style="font-size: 24px; display: block; margin-bottom: 8px;">✓</span>Tidak ada anomali kritis terdeteksi untuk filter aktif.</div>';
    return;
  }

  cardList.forEach((c) => {
    const card = document.createElement("div");
    let borderClass = "info-border";
    if (c.severity === "severe") borderClass = "severe-border";
    else if (c.severity === "warning") borderClass = "warning-border";
    else borderClass = "info-border";

    let badgeClass = "info";
    if (c.severity === "severe") badgeClass = "severe";
    else if (c.severity === "warning") badgeClass = "warning";

    card.className = "alert-card " + borderClass;
    card.innerHTML =
      '<div class="alert-header"><span class="alert-title">' +
      c.title +
      '</span><span class="badge ' +
      badgeClass +
      '">' +
      c.severity +
      '</span></div><p class="alert-insight"><strong>AI Insight:</strong> ' +
      c.insight +
      '</p><div class="alert-recommendation"><strong>Rekomendasi:</strong> ' +
      c.recommendation +
      "</div>";
    grid.appendChild(card);
  });
}

// Render Recommendations (dynamically from stats + anomalies)
function renderRecommendations(stats, anomalies) {
  const container = document.getElementById("recommendations-container");
  if (!container) return;

  const recs = [];

  // Rec 1: Berdasarkan outlier profit margin
  const profitOutliers = (anomalies.profitOutliers || [])
    .filter(o => parseFloat(o.margin) < 10)
    .sort((a, b) => parseFloat(a.margin) - parseFloat(b.margin));

  if (profitOutliers.length > 0) {
    const worst = profitOutliers[0];
    const isSevere = parseFloat(worst.margin) < 0;
    recs.push({
      icon: "percent",
      iconBg: isSevere
        ? 'style="background:rgba(220,38,38,0.1);color:#DC2626;"'
        : 'style="background:rgba(234,88,12,0.1);color:#EA580C;"',
      title: "Batasi Diskon " + worst.name,
      priority: isSevere ? "high" : "medium",
      priorityLabel: isSevere ? "Tinggi" : "Sedang",
      description:
        "Margin " + worst.margin + "% (Z=" + worst.zScore + "). Batas diskon maks & evaluasi markup harga.",
      impact: "+" + (Math.abs(parseFloat(worst.margin)) * 0.3).toFixed(1) + "% Margin",
      cardClass: isSevere ? "priority-high" : "priority-medium",
    });
  }

  // Rec 2: Category terburuk
  const worstCat = stats.worstCategory;
  if (worstCat && worstCat.category !== "N/A" && parseFloat(worstCat.margin) < 15) {
    const isBad = parseFloat(worstCat.margin) < 5;
    recs.push({
      icon: "trending-down",
      iconBg: isBad
        ? 'style="background:rgba(220,38,38,0.1);color:#DC2626;"'
        : 'style="background:rgba(234,88,12,0.1);color:#EA580C;"',
      title: "Review Harga " + worstCat.category,
      priority: isBad ? "high" : "medium",
      priorityLabel: isBad ? "Tinggi" : "Sedang",
      description:
        "Margin terendah (" + worstCat.margin + "%). Tinjau struktur biaya & kebijakan diskon.",
      impact: "+" + (Math.max(0, 15 - parseFloat(worstCat.margin)) * 0.2).toFixed(1) + "% Margin",
      cardClass: isBad ? "priority-high" : "priority-medium",
    });
  }

  // Rec 3: MoM drop
  const momDrops = (anomalies.momSpikes || []).filter(s => s.direction === "drop");
  if (momDrops.length > 0) {
    const drop = momDrops[0];
    const isSevere = drop.severity === "severe";
    recs.push({
      icon: "alert-triangle",
      iconBg: 'style="background:rgba(245,158,11,0.1);color:#F59E0B;"',
      title: "Investigasi Drop " + drop.month,
      priority: isSevere ? "high" : "medium",
      priorityLabel: isSevere ? "Tinggi" : "Sedang",
      description:
        "Sales turun " + Math.abs(parseFloat(drop.changePct)).toFixed(0) + "% MoM. Identifikasi penyebab: musiman atau supply issue.",
      impact: "+$" + ((parseFloat(drop.previous) - parseFloat(drop.current)) * 0.3 / 1000).toFixed(0) + "K Recovery",
      cardClass: isSevere ? "priority-high" : "priority-medium",
    });
  }

  // Rec 4: Category terbaik (opportunity)
  const bestCat = stats.bestCategory;
  if (bestCat && bestCat.category !== "N/A" && parseFloat(bestCat.margin) > 10) {
    recs.push({
      icon: "boxes",
      iconBg: 'style="background:var(--primary-light);color:var(--primary);"',
      title: "Perluas " + bestCat.category,
      priority: "medium",
      priorityLabel: "Sedang",
      description:
        "Margin kuat (" + bestCat.margin + "%). Alihkan kapasitas ke produk yang lebih menguntungkan.",
      impact: "+$" + (parseFloat(stats.totalSales) * 0.05 / 1000).toFixed(0) + "K Sales",
      cardClass: "priority-medium",
    });
  }

  // Rec 5: IQR outlier
  if (anomalies.salesOutliersIQR && anomalies.salesOutliersIQR.totalOutliers > 5) {
    const topSubcat = anomalies.salesOutliersIQR.subcatOutliers?.[0];
    recs.push({
      icon: "shield-alert",
      iconBg: 'style="background:rgba(139,92,246,0.1);color:#8B5CF6;"',
      title: "Validasi Transaksi Ekstrem",
      priority: "low",
      priorityLabel: "Rendah",
      description:
        anomalies.salesOutliersIQR.totalOutliers + " outlier IQR" +
        (topSubcat ? ", terpusat di " + topSubcat.subcat : "") +
        ". Pastikan bukan error input.",
      impact: "Data Quality Audit",
      cardClass: "priority-low",
    });
  }

  // Rec 6: Margin overall rendah
  if (parseFloat(stats.overallMargin) < 8 && recs.length < 4) {
    recs.push({
      icon: "target",
      iconBg: 'style="background:rgba(220,38,38,0.1);color:#DC2626;"',
      title: "Evaluasi Struktur Biaya",
      priority: "high",
      priorityLabel: "Tinggi",
      description:
        "Margin keseluruhan hanya " + stats.overallMargin + "%. Tinjau COGS, logistics, & discount policies.",
      impact: "+" + (8 - parseFloat(stats.overallMargin)).toFixed(1) + "% Margin",
      cardClass: "priority-high",
    });
  }

  // Rec 7: Segment terbaik
  const bestSeg = stats.bestSegment;
  if (bestSeg && bestSeg.segment !== "N/A" && recs.length < 4) {
    recs.push({
      icon: "users",
      iconBg: 'style="background:rgba(16,185,129,0.1);color:#10B981;"',
      title: "Fokus Segment " + bestSeg.segment,
      priority: "low",
      priorityLabel: "Rendah",
      description:
        "Segment terbaik (" + bestSeg.margin + "% margin). Tingkatkan penetrasi & repeat order.",
      impact: "+$" + (parseFloat(stats.totalSales) * 0.03 / 1000).toFixed(0) + "K Sales",
      cardClass: "priority-low",
    });
  }

  // Fallback (Empty State)
  if (recs.length === 0) {
    recs.push({
      icon: "check-circle",
      iconBg: 'style="background:rgba(16,185,129,0.1);color:#10B981;"',
      title: "Performa Stabil",
      priority: "low",
      priorityLabel: "Monitor",
      description: "Tidak ada anomali kritis. Pertahankan strategi & monitoring rutin.",
      impact: "Maintain Status",
      cardClass: "priority-low",
    });
  }

  const priorityOrder = { high: 0, medium: 1, low: 2 };
  recs.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  const finalRecs = recs.slice(0, 6);

  container.innerHTML = finalRecs
    .map(r =>
      '<div class="rec-card ' + r.cardClass + '">' +
      '  <div class="rec-left">' +
      '    <div class="rec-icon" ' + r.iconBg + '>' +
      '      <i data-lucide="' + r.icon + '"></i>' +
      "    </div>" +
      "  </div>" +
      '  <div class="rec-right">' +
      '    <div class="rec-header">' +
      '      <h4 class="rec-title">' + r.title + "</h4>" +
      '      <span class="rec-priority ' + r.priority + '">' + r.priorityLabel + "</span>" +
      "    </div>" +
      '    <p class="rec-description">' + r.description + "</p>" +
      '    <div class="rec-metadata">' +
      '      <span class="rec-meta-item">' +
      '        <i data-lucide="target" style="width:11px;height:11px"></i>' +
      "        <strong>" + r.impact + "</strong>" +
      "      </span>" +
      "    </div>" +
      "  </div>" +
      "</div>"
    )
    .join("");

  if (typeof lucide !== "undefined") lucide.createIcons();
}

function renderChartsWorkspace(data) {
  const monthsFiltered = getFilteredMonthsList();
  const monthsLabels = monthsFiltered.map((m) => monthNames[m]);
  const monthlyAgg = Array(12)
    .fill(0)
    .map(() => ({ sales: 0, profit: 0 }));
  data.forEach((d) => {
    monthlyAgg[d.orderDate.getMonth()].sales += d.sales;
    monthlyAgg[d.orderDate.getMonth()].profit += d.profit;
  });
  const salesTrendData = monthsFiltered.map((m) => monthlyAgg[m].sales);
  const profitTrendData = monthsFiltered.map((m) => monthlyAgg[m].profit);

  chartSalesTrend = renderLineChart(
    "chart-sales-trend",
    monthsLabels,
    salesTrendData,
    "Sales ($)",
    "#2563EB",
    [],
  );
  chartProfitTrend = renderLineChart(
    "chart-profit-trend",
    monthsLabels,
    profitTrendData,
    "Profit ($)",
    "#16A34A",
    [],
  );

  const catSales = {},
    catProfit = {};
  data.forEach((d) => {
    if (!catSales[d.category]) {
      catSales[d.category] = 0;
      catProfit[d.category] = 0;
    }
    catSales[d.category] += d.sales;
    catProfit[d.category] += d.profit;
  });
  const catLabels = Object.keys(catSales);
  const catSalesValues = Object.values(catSales);
  const catMargins = catLabels.map((cat) =>
    catSales[cat] > 0 ? (catProfit[cat] / catSales[cat]) * 100 : 0,
  );
  const catColors = catLabels.map(
    (_, i) => colorPalette[i % colorPalette.length],
  );
  const marginColors = catMargins.map((m) =>
    m < 10 ? "#DC2626" : m > 20 ? "#16A34A" : "#EA580C",
  );

  chartSalesCategory = renderBarChart(
    "chart-sales-category",
    catLabels,
    catSalesValues,
    "Sales ($)",
    catColors,
  );
  chartMarginCategory = renderBarChart(
    "chart-margin-category",
    catLabels,
    catMargins,
    "Margin (%)",
    marginColors,
    "%",
  );

  const terrProfit = {};
  data.forEach((d) => {
    if (!terrProfit[d.territory]) terrProfit[d.territory] = 0;
    terrProfit[d.territory] += d.profit;
  });
  const sortedTerr = Object.keys(terrProfit).sort(
    (a, b) => terrProfit[a] - terrProfit[b],
  );
  const sortedProfit = sortedTerr.map((t) => terrProfit[t]);
  const terrColors = sortedProfit.map((p) => (p < 0 ? "#DC2626" : "#2563EB"));
  chartProfitTerritory = renderHorizontalBarChart(
    "chart-profit-territory",
    sortedTerr,
    sortedProfit,
    "Profit ($)",
    terrColors,
  );

  const subStats = {};
  data.forEach((d) => {
    if (!subStats[d.subcat])
      subStats[d.subcat] = {
        sales: 0,
        profit: 0,
        qty: 0,
        category: d.category,
      };
    subStats[d.subcat].sales += d.sales;
    subStats[d.subcat].profit += d.profit;
    subStats[d.subcat].qty += d.quantity;
  });
  const scatterPoints = Object.keys(subStats).map((sub) => {
    const st = subStats[sub];
    let color =
      colorPalette[catLabels.indexOf(st.category) % colorPalette.length] ||
      "#6B7280";
    if (st.profit < 0) color = "#DC2626";
    return {
      x: st.sales,
      y: st.profit,
      r: Math.max(5, Math.min(st.qty / 5, 20)),
      label: sub,
      color,
    };
  });
  chartScatter = renderScatterChart(
    "chart-sales-profit-scatter",
    scatterPoints,
  );
}

function renderLineChart(
  canvasId,
  labels,
  dataPoints,
  datasetLabel,
  color,
  anomalies,
) {
  const canvasEl = document.getElementById(canvasId);
  if (!canvasEl) return null;
  const ctx = canvasEl.getContext("2d");
  const existing = Chart.getChart(canvasId);
  if (existing) existing.destroy();
  const grad = ctx.createLinearGradient(0, 0, 0, 200);
  grad.addColorStop(0, color + "22");
  grad.addColorStop(1, color + "00");
  return new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: datasetLabel,
          data: dataPoints,
          borderColor: color,
          borderWidth: 2.5,
          backgroundColor: grad,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: color,
          pointRadius: 3,
          pointHoverRadius: 7,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function (ctx) {
              return ctx.dataset.label + ": " + formatCurrency(ctx.parsed.y);
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            font: { size: 10, family: "'Inter', sans-serif" },
            color: "#9CA3AF",
          },
        },
        y: {
          grid: { color: "#F3F4F6" },
          ticks: {
            font: { size: 10, family: "'Inter', sans-serif" },
            color: "#9CA3AF",
            callback: (v) => formatShortNumber(v),
          },
        },
      },
    },
  });
}

function renderBarChart(canvasId, labels, data, datasetLabel, colors, suffix) {
  const canvasEl = document.getElementById(canvasId);
  if (!canvasEl) return null;
  const ctx = canvasEl.getContext("2d");
  const existing = Chart.getChart(canvasId);
  if (existing) existing.destroy();
  return new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: datasetLabel,
          data,
          backgroundColor: colors,
          borderRadius: 8,
          maxBarThickness: 40,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            font: { size: 10, family: "'Inter', sans-serif" },
            color: "#9CA3AF",
          },
        },
        y: {
          grid: { color: "#F3F4F6" },
          ticks: {
            font: { size: 10, family: "'Inter', sans-serif" },
            color: "#9CA3AF",
            callback: (v) => (suffix ? v + suffix : formatShortNumber(v)),
          },
        },
      },
    },
  });
}

function renderHorizontalBarChart(
  canvasId,
  labels,
  data,
  datasetLabel,
  colors,
) {
  const canvasEl = document.getElementById(canvasId);
  if (!canvasEl) return null;
  const ctx = canvasEl.getContext("2d");
  const existing = Chart.getChart(canvasId);
  if (existing) existing.destroy();
  return new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: datasetLabel,
          data,
          backgroundColor: colors,
          borderRadius: 6,
          maxBarThickness: 18,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          grid: { color: "#F3F4F6" },
          ticks: {
            font: { size: 10, family: "'Inter', sans-serif" },
            color: "#9CA3AF",
            callback: (v) => formatShortNumber(v),
          },
        },
        y: {
          grid: { display: false },
          ticks: {
            font: { size: 10, family: "'Inter', sans-serif" },
            color: "#6B7280",
          },
        },
      },
    },
  });
}

function renderScatterChart(canvasId, points) {
  const canvasEl = document.getElementById(canvasId);
  if (!canvasEl) return null;
  const ctx = canvasEl.getContext("2d");
  const existing = Chart.getChart(canvasId);
  if (existing) existing.destroy();
  return new Chart(ctx, {
    type: "scatter",
    data: {
      datasets: [
        {
          data: points.map((p) => ({ x: p.x, y: p.y })),
          backgroundColor: points.map((p) => p.color + "AA"),
          borderColor: points.map((p) => p.color),
          borderWidth: 1.5,
          pointRadius: points.map((p) => p.r),
          pointHoverRadius: points.map((p) => p.r + 3),
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function (ctx) {
              const pt = points[ctx.dataIndex];
              return (
                pt.label +
                " | Sales: " +
                formatCurrency(pt.x) +
                " | Profit: " +
                formatCurrency(pt.y)
              );
            },
          },
        },
      },
      scales: {
        x: {
          title: {
            display: true,
            text: "Sales ($)",
            font: { size: 11, weight: "bold", family: "'Inter', sans-serif" },
            color: "#6B7280",
          },
          grid: { color: "#F3F4F6" },
          ticks: {
            font: { size: 10 },
            color: "#9CA3AF",
            callback: (v) => formatShortNumber(v),
          },
        },
        y: {
          title: {
            display: true,
            text: "Profit ($)",
            font: { size: 11, weight: "bold", family: "'Inter', sans-serif" },
            color: "#6B7280",
          },
          grid: { color: "#F3F4F6" },
          ticks: {
            font: { size: 10 },
            color: "#9CA3AF",
            callback: (v) => formatShortNumber(v),
          },
        },
      },
    },
  });
}

// Product Table
function updateProductTables() {
  const prodAgg = {};
  filteredData.forEach((d) => {
    if (!prodAgg[d.productName])
      prodAgg[d.productName] = {
        name: d.productName,
        sales: 0,
        profit: 0,
        qty: 0,
        category: d.category,
        territory: d.territory,
      };
    prodAgg[d.productName].sales += d.sales;
    prodAgg[d.productName].profit += d.profit;
    prodAgg[d.productName].qty += d.quantity;
  });
  filteredSalesProducts = [...Object.values(prodAgg)];
  sortProductsArray(
    filteredSalesProducts,
    currentSalesSort.column,
    currentSalesSort.direction,
  );
  filteredProfitProducts = [...Object.values(prodAgg)];
  sortProductsArray(
    filteredProfitProducts,
    currentProfitSort.column,
    currentProfitSort.direction,
  );
  renderSalesTable();
  renderProfitTable();
}

function sortProductsArray(arr, col, dir) {
  arr.sort((a, b) => {
    let valA = a[col],
      valB = b[col];
    if (col === "margin") {
      valA = a.sales > 0 ? (a.profit / a.sales) * 100 : 0;
      valB = b.sales > 0 ? (b.profit / b.sales) * 100 : 0;
    }
    if (typeof valA === "string")
      return dir === "asc"
        ? valA.localeCompare(valB)
        : valB.localeCompare(valA);
    return dir === "asc" ? valA - valB : valB - valA;
  });
}

function renderSalesTable() {
  const searchVal = (
    document.getElementById("search-sales-table")?.value || ""
  ).toLowerCase();
  let searchList = (filteredSalesProducts || []).filter((p) =>
    (p.name || "").toLowerCase().includes(searchVal),
  );
  const tbody = document.getElementById("sales-table-body");
  tbody.innerHTML = "";
  const totalItems = searchList.length,
    startIdx = (salesTablePage - 1) * itemsPerPage,
    endIdx = Math.min(startIdx + itemsPerPage, totalItems);
  const pageItems = searchList.slice(startIdx, endIdx);
  if (pageItems.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="4" style="text-align:center;color:var(--gray-400);padding:20px;">Tidak ada produk cocok.</td></tr>';
    document.getElementById("sales-table-info").innerText = "0 produk";
    document.getElementById("sales-prev-btn").disabled = true;
    document.getElementById("sales-next-btn").disabled = true;
    return;
  }
  pageItems.forEach((p) => {
    const tr = document.createElement("tr");
    tr.innerHTML =
      '<td class="cell-product-name" title="' +
      p.name +
      '">' +
      p.name +
      '</td><td class="cell-number">' +
      formatCurrency(p.sales) +
      '</td><td class="cell-number">' +
      p.qty +
      '</td><td class="cell-number ' +
      (p.profit < 0 ? "critical" : "success") +
      '" style="font-weight:500;">' +
      formatCurrency(p.profit) +
      "</td>";
    tbody.appendChild(tr);
  });
  document.getElementById("sales-table-info").innerText =
    "Menampilkan " +
    (startIdx + 1) +
    "-" +
    endIdx +
    " dari " +
    totalItems +
    " produk";
  document.getElementById("sales-prev-btn").disabled = salesTablePage === 1;
  document.getElementById("sales-next-btn").disabled = endIdx >= totalItems;
}

function renderProfitTable() {
  const searchVal = (
    document.getElementById("search-profit-table")?.value || ""
  ).toLowerCase();
  let searchList = (filteredProfitProducts || []).filter((p) =>
    (p.name || "").toLowerCase().includes(searchVal),
  );
  const tbody = document.getElementById("profit-table-body");
  tbody.innerHTML = "";
  const totalItems = searchList.length,
    startIdx = (profitTablePage - 1) * itemsPerPage,
    endIdx = Math.min(startIdx + itemsPerPage, totalItems);
  const pageItems = searchList.slice(startIdx, endIdx);
  if (pageItems.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="4" style="text-align:center;color:var(--gray-400);padding:20px;">Tidak ada produk cocok.</td></tr>';
    document.getElementById("profit-table-info").innerText = "0 produk";
    document.getElementById("profit-prev-btn").disabled = true;
    document.getElementById("profit-next-btn").disabled = true;
    return;
  }
  pageItems.forEach((p) => {
    const margin = p.sales > 0 ? (p.profit / p.sales) * 100 : 0;
    const tr = document.createElement("tr");
    tr.innerHTML =
      '<td class="cell-product-name" title="' +
      p.name +
      '">' +
      p.name +
      '</td><td class="cell-number ' +
      (p.profit < 0 ? "critical" : "success") +
      '" style="font-weight:600;">' +
      formatCurrency(p.profit) +
      '</td><td class="cell-number"><span class="cell-badge ' +
      (margin < 0 ? "neg" : "pos") +
      '">' +
      margin.toFixed(1) +
      "%</span></td><td>" +
      p.territory +
      "</td>";
    tbody.appendChild(tr);
  });
  document.getElementById("profit-table-info").innerText =
    "Menampilkan " +
    (startIdx + 1) +
    "-" +
    endIdx +
    " dari " +
    totalItems +
    " produk";
  document.getElementById("profit-prev-btn").disabled = profitTablePage === 1;
  document.getElementById("profit-next-btn").disabled = endIdx >= totalItems;
}

function sortSalesTable(col) {
  if (currentSalesSort.column === col)
    currentSalesSort.direction =
      currentSalesSort.direction === "desc" ? "asc" : "desc";
  else {
    currentSalesSort.column = col;
    currentSalesSort.direction = "desc";
  }
  updateHeadersSortClasses("sales-table", currentSalesSort);
  updateProductTables();
}
function sortProfitTable(col) {
  if (currentProfitSort.column === col)
    currentProfitSort.direction =
      currentProfitSort.direction === "desc" ? "asc" : "desc";
  else {
    currentProfitSort.column = col;
    currentProfitSort.direction = "desc";
  }
  updateHeadersSortClasses("profit-table", currentProfitSort);
  updateProductTables();
}
function updateHeadersSortClasses(tableId, sortObj) {
  document.querySelectorAll("#" + tableId + " th").forEach((th) => {
    th.classList.remove("sort-asc", "sort-desc");
    if ((th.getAttribute("onclick") || "").includes("'" + sortObj.column + "'"))
      th.classList.add(sortObj.direction === "asc" ? "sort-asc" : "sort-desc");
  });
}
function paginateSales(dir) {
  salesTablePage += dir;
  renderSalesTable();
}
function paginateProfit(dir) {
  profitTablePage += dir;
  renderProfitTable();
}
function filterSalesTable() {
  salesTablePage = 1;
  renderSalesTable();
}
function filterProfitTable() {
  profitTablePage = 1;
  renderProfitTable();
}

// Sidebar & Tab Navigation
function toggleSidebar() {
  const sidebar = document.getElementById("filter-sidebar");
  const content = document.getElementById("dashboard-content-panel");
  sidebarCollapsed = !sidebarCollapsed;
  if (sidebarCollapsed) {
    sidebar.classList.add("collapsed");
  } else {
    sidebar.classList.remove("collapsed");
  }
  if (typeof lucide !== "undefined") lucide.createIcons();
}

// Tableau Fullscreen Toggle
function toggleTableauFullscreen() {
  const elem = document.getElementById("tableau-fullscreen-container");
  if (!elem) return;

  if (!document.fullscreenElement) {
    elem.requestFullscreen().catch((err) => {
      alert(`Gagal membuka mode layar penuh: ${err.message}`);
    });
  } else {
    document.exitFullscreen();
  }
}

function isSmallScreen() {
  return window.innerWidth <= 900;
}

function collapseSidebar() {
  const sidebar = document.getElementById("filter-sidebar");
  if (!sidebar) return;
  sidebar.classList.add("collapsed");
  sidebarCollapsed = true;
}

function expandSidebar() {
  const sidebar = document.getElementById("filter-sidebar");
  if (!sidebar) return;
  sidebar.classList.remove("collapsed");
  sidebarCollapsed = false;
}

function ensureSidebarResponsive() {
  const sidebar = document.getElementById("filter-sidebar");
  if (!sidebar) return;
  if (isSmallScreen()) {
    sidebar.classList.add("collapsed");
    sidebarCollapsed = true;
  } else {
    sidebar.classList.remove("collapsed");
    sidebarCollapsed = false;
  }
}

window.addEventListener("resize", () => {
  ensureSidebarResponsive();
});

ensureSidebarResponsive();

function switchTab(tab) {
  activeTab = tab;
  const tabAi = document.getElementById("tab-ai-dash");
  const tabTab = document.getElementById("tab-tableau-dash");
  const panelAi = document.getElementById("dashboard-content-panel");
  const panelTab = document.getElementById("tableau-content-panel");
  const sidebar = document.getElementById("filter-sidebar");
  const sidebarToggle = document.getElementById("sidebar-toggle");

  if (tab === "ai") {
    tabAi.classList.add("active");
    tabTab.classList.remove("active");
    
    panelAi.classList.add("active");
    panelTab.classList.remove("active");
    
    if(sidebar) sidebar.style.display = "flex";
    if(sidebarToggle) sidebarToggle.style.display = "flex";
  } else {
    tabAi.classList.remove("active");
    tabTab.classList.add("active");
    
    panelAi.classList.remove("active");
    panelTab.classList.add("active");
    
    // Hide sidebar
    if(sidebar) sidebar.style.display = "none";
    if(sidebarToggle) sidebarToggle.style.display = "none";
  }
}

function switchSubTab(tabName) {
  document.querySelectorAll(".sub-tab-btn").forEach((btn) => {
    btn.classList.remove("active");
    if (
      btn.getAttribute("onclick") &&
      btn.getAttribute("onclick").includes("'" + tabName + "'")
    )
      btn.classList.add("active");
  });
  document
    .querySelectorAll(".tab-panel")
    .forEach((panel) => panel.classList.remove("active"));
  const activePanel = document.getElementById("panel-" + tabName);
  if (activePanel) activePanel.classList.add("active");
  if (tabName === "analytics") {
    setTimeout(() => {
      [
        chartSalesTrend,
        chartProfitTrend,
        chartSalesCategory,
        chartMarginCategory,
        chartProfitTerritory,
        chartScatter,
      ].forEach((c) => {
        if (c) c.resize();
      });
    }, 60);
  }
}

// AI Chat & Insight
async function requestInsight() {
  const btn = document.getElementById("btn-insight");
  const output = document.getElementById("insight-output");
  const question = document.getElementById("custom-question")?.value.trim();
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Memproses...";
  }
  if (output)
    output.innerHTML =
      '<div style="padding:20px;display:flex;align-items:center;gap:12px;font-size:13px;color:var(--gray-500);"><div class="spinner-sm"></div>Menghubungi AI...</div>';
  try {
    const insightText = await getInsight(
      summaryStats,
      detectedAnomalies,
      question,
    );
    if (output)
      output.innerHTML =
        '<div style="font-size:13px;line-height:1.7;color:var(--gray-700);">' +
        formatInsight(insightText) +
        "</div>";
  } catch (err) {
    if (output)
      output.innerHTML =
        '<div style="color:var(--critical);font-size:12px;border:1px solid rgba(220,38,38,0.2);background:rgba(220,38,38,0.02);padding:16px;border-radius:var(--radius-md);"><strong>Gagal:</strong><br>' +
        err.message +
        "</div>";
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Minta Insight →";
    }
  }
}

async function sendCustomChatMessage() {
  const inputEl = document.getElementById("chat-input");
  const query = inputEl.value.trim();
  if (!query) return;
  appendChatMessage(query, "user");
  inputEl.value = "";
  showChatLoading();
  try {
    const answer = await getInsight(summaryStats, detectedAnomalies, query);
    removeChatLoading();
    appendChatMessage(formatInsight(answer), "ai");
  } catch (err) {
    removeChatLoading();
    appendChatMessage(
      '<span style="color:var(--critical);">Gagal: ' + err.message + "</span>",
      "ai",
    );
  }
}

function askAIChat(question) {
  document.getElementById("chat-input").value = question;
  sendCustomChatMessage();
}

function appendChatMessage(content, sender) {
  const chatBox = document.getElementById("chat-messages-box");
  const bubble = document.createElement("div");
  bubble.className = "chat-bubble " + sender;
  bubble.innerHTML = content;
  chatBox.appendChild(bubble);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function showChatLoading() {
  const chatBox = document.getElementById("chat-messages-box");
  const loading = document.createElement("div");
  loading.className = "chat-bubble ai";
  loading.id = "chat-loading-bubble";
  loading.innerHTML =
    '<div class="chat-loading-dots"><span></span><span></span><span></span></div>';
  chatBox.appendChild(loading);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function removeChatLoading() {
  const loader = document.getElementById("chat-loading-bubble");
  if (loader) loader.remove();
}

function highlightKPI(metric) {
  showTemporaryBanner(
    "Menyorot data " + metric.toUpperCase() + " pada grafik.",
  );
}

function formatInsight(text) {
  return text
    .split("\n")
    .map((line) => {
      line = line.trim();
      if (!line) return "<br>";
      if (line.match(/^(\d+\.|[-*•])\s/))
        return (
          '<p style="margin-left:14px;margin-bottom:4px;font-weight:500;">' +
          line +
          "</p>"
        );
      if (line.match(/^[A-Z]/) && line.includes(":"))
        return (
          '<p style="font-weight:700;color:var(--gray-900);margin-top:8px;margin-bottom:4px;">' +
          line +
          "</p>"
        );
      return '<p style="margin-bottom:6px;">' + line + "</p>";
    })
    .join("");
}

function showTemporaryBanner(text) {
  const banner = document.createElement("div");
  banner.className = "toast-banner";
  banner.innerText = text;
  document.body.appendChild(banner);
  requestAnimationFrame(() => banner.classList.add("visible"));
  setTimeout(() => {
    banner.classList.remove("visible");
    setTimeout(() => banner.remove(), 300);
  }, 3000);
}
