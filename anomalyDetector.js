function mean(arr) {
  return arr.length === 0 ? 0 : arr.reduce((s, v) => s + v, 0) / arr.length;
}

function stdDev(arr) {
  const m = mean(arr);
  const variance = arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

function zScore(value, arr) {
  const m = mean(arr);
  const s = stdDev(arr);
  return s === 0 ? 0 : (value - m) / s;
}

function percentile(arr, p) {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const frac = idx - lower;
  return sorted[lower] + frac * (sorted[lower + 1] - sorted[lower] || 0);
}

function detectProfitOutliers(data, threshold) {
  threshold = threshold || 1.2;
  const rawDataMap = d3.rollups(
    data,
    (v) => ({
      profit: d3.sum(v, (d) => d.profit),
      sales: d3.sum(v, (d) => d.sales),
    }),
    (d) => d.subcat,
  );

  const bySubcat = Array.from(rawDataMap, ([name, v]) => ({
    name,
    profit: v.profit,
    sales: v.sales,
    margin: v.sales > 0 ? (v.profit / v.sales) * 100 : 0,
  }));

  const margins = bySubcat.map((d) => d.margin);

  return bySubcat
    .map((d) => {
      const z = zScore(d.margin, margins);
      return {
        type: "profit_outlier",
        name: d.name,
        margin: d.margin.toFixed(1),
        profit: d.profit.toFixed(0),
        zScore: z.toFixed(2),
        direction: z > 0 ? "high" : "low",
        severity: Math.abs(z) > 1.8 ? "severe" : "warning",
        isOutlier: Math.abs(z) > threshold,
      };
    })
    .filter((d) => d.isOutlier)
    .sort((a, b) => parseFloat(a.zScore) - parseFloat(b.zScore));
}

function detectMoMSpikes(data, threshold) {
  threshold = threshold || 25;
  const byMonth = d3
    .rollups(
      data,
      (v) => ({
        sales: d3.sum(v, (d) => d.sales),
        profit: d3.sum(v, (d) => d.profit),
      }),
      (d) => {
        const dt = d.orderDate;
        return (
          dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0")
        );
      },
    )
    .map(([month, v]) => ({ month, ...v }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const anomalies = [];

  for (let i = 1; i < byMonth.length; i++) {
    const curr = byMonth[i];
    const prev = byMonth[i - 1];
    if (prev.sales === 0) continue;

    const momPct = ((curr.sales - prev.sales) / Math.abs(prev.sales)) * 100;

    if (Math.abs(momPct) >= threshold) {
      anomalies.push({
        type: "mom_spike",
        month: curr.month,
        prevMonth: prev.month,
        current: curr.sales.toFixed(0),
        previous: prev.sales.toFixed(0),
        changePct: momPct.toFixed(1),
        direction: momPct > 0 ? "spike" : "drop",
        severity:
          Math.abs(momPct) >= 40
            ? "severe"
            : Math.abs(momPct) >= 25
              ? "warning"
              : "info",
      });
    }
  }

  return anomalies
    .sort(
      (a, b) =>
        Math.abs(parseFloat(b.changePct)) - Math.abs(parseFloat(a.changePct)),
    )
    .slice(0, 8);
}

function detectSalesOutliersIQR(data) {
  if (data.length === 0)
    return {
      fences: { lower: 0, upper: 0 },
      totalOutliers: 0,
      subcatOutliers: [],
      bySubcat: [],
    };

  const salesValues = data.map((d) => d.sales);
  const Q1 = percentile(salesValues, 25);
  const Q3 = percentile(salesValues, 75);
  const IQR = Q3 - Q1;
  const lower = Q1 - 1.5 * IQR;
  const upper = Q3 + 1.5 * IQR;

  const outlierRows = data.filter((d) => d.sales < lower || d.sales > upper);

  const countBySubcat = d3
    .rollups(
      outlierRows,
      (v) => ({
        count: v.length,
        avgSales: d3.mean(v, (d) => d.sales),
        maxSales: d3.max(v, (d) => d.sales),
      }),
      (d) => d.subcat,
    )
    .map(([subcat, v]) => ({
      type: "iqr_outlier",
      subcat,
      count: v.count,
      avgSales: v.avgSales.toFixed(0),
      maxSales: v.maxSales.toFixed(0),
      severity: v.count > 10 ? "warning" : "info",
    }))
    .sort((a, b) => b.count - a.count);

  return {
    fences: { lower: lower.toFixed(2), upper: upper.toFixed(2), Q1, Q3, IQR },
    totalOutliers: outlierRows.length,
    subcatOutliers: countBySubcat,
    bySubcat: countBySubcat.slice(0, 5),
  };
}

// Master Detektor
function detectAllAnomalies(data) {
  return {
    profitOutliers: detectProfitOutliers(data, 1.2),
    momSpikes: detectMoMSpikes(data, 25),
    salesOutliersIQR: detectSalesOutliersIQR(data),
  };
}

function countSeverity(anomalies) {
  const all = [
    ...(anomalies.profitOutliers || []),
    ...(anomalies.momSpikes || []),
    ...((anomalies.salesOutliersIQR && anomalies.salesOutliersIQR.bySubcat) ||
      []),
  ];
  return {
    severe: all.filter((d) => d.severity === "severe").length,
    warning: all.filter((d) => d.severity === "warning").length,
    info: all.filter((d) => d.severity === "info").length,
  };
}
