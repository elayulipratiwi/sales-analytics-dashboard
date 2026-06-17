async function generateTitle(summary, anomalies) {
  const severeCount =
    (anomalies.profitOutliers || []).filter((a) => a.severity === "severe")
      .length +
    (anomalies.momSpikes || []).filter((a) => a.severity === "severe").length;
  const worst =
    (anomalies.profitOutliers || [])[0] ||
    (anomalies.momSpikes || [])[0] ||
    null;

  const context = `Data penjualan SALES dataset:
- Total Sales: $${summary.totalSales}, Profit Margin: ${summary.overallMargin}%
- Total Orders: ${summary.totalOrders}
- Anomali kritis terdeteksi: ${severeCount}
 ${worst ? "- Anomali terparah: " + JSON.stringify(worst) : ""}`;

  const prompt =
    context +
    `

Tulis SATU judul dashboard dalam Bahasa Indonesia.
Judul harus NARATIF (mengandung insight, bukan deskriptif).
Maksimal 12 kata. Format: fakta kunci + implikasi.
Contoh baik: "Margin Tertekan di Clothing — Review Diskon Jadi Prioritas"
Contoh buruk: "Dashboard Penjualan Sales"
Hanya tulis judulnya saja, tanpa tanda kutip.`;

  try {
    return await getInsight(summary, anomalies, prompt);
  } catch (e) {
    console.warn("generateTitle error:", e);
    return null;
  }
}

async function generateStory(summary, anomalies) {
  const prompt = buildStoryPrompt(summary, anomalies);
  try {
    return await getInsight(summary, anomalies, prompt);
  } catch (e) {
    console.warn("generateStory error:", e);
    return null;
  }
}

function buildStoryPrompt(summary, anomalies) {
  const profitLines =
    (anomalies.profitOutliers || [])
      .map(
        (a) =>
          "  - " +
          a.name +
          ": margin " +
          a.margin +
          "% (Z=" +
          a.zScore +
          ", " +
          a.severity +
          ")",
      )
      .join("\n") || "  Tidak ada";
  const momLines =
    (anomalies.momSpikes || [])
      .slice(0, 3)
      .map(
        (a) =>
          "  - " + a.month + ": " + a.changePct + "% MoM (" + a.severity + ")",
      )
      .join("\n") || "  Tidak ada";
  const catLines = (summary.categories || [])
    .map(
      (c) =>
        "  - " +
        c.category +
        ": sales $" +
        (+c.sales / 1000).toFixed(0) +
        "K, margin " +
        c.margin +
        "%",
    )
    .join("\n");

  return `Kamu adalah analis bisnis senior. Berdasarkan data penjualan berikut, tulis narasi SCR:

DATA KESELURUHAN:
  Total Sales: $${summary.totalSales}
  Total Profit: $${summary.totalProfit}
  Profit Margin: ${summary.overallMargin}%
  Total Orders: ${summary.totalOrders}

PERFORMA PER KATEGORI:
 ${catLines}

ANOMALI PROFIT MARGIN (Z-score):
 ${profitLines}

ANOMALI PERUBAHAN BULANAN:
 ${momLines}

Tulis narasi dalam Bahasa Indonesia dengan FORMAT PERSIS:

**SETUP**
[1-2 kalimat konteks situasi bisnis saat ini, sebutkan angka]

**CONFLICT**
[1-2 kalimat masalah/anomali paling kritis yang ditemukan]

**RESOLUTION**
[1-2 kalimat rekomendasi konkret yang bisa dilakukan]

Gunakan angka spesifik dari data. Maksimal 6 kalimat total. Langsung ke poin. Jangan gunakan bahasa robotik.`;
}

function parseStoryResponse(text) {
  if (!text) return { setup: "", conflict: "", resolution: "", raw: "" };
  const result = { setup: "", conflict: "", resolution: "", raw: text };

  const s = text.match(
    /\*{0,2}SETUP\*{0,2}[\s\S]*?\n([\s\S]*?)(?=\*{0,2}CONFLICT|\*{0,2}RESOLUTION|$)/i,
  );
  const c = text.match(
    /\*{0,2}CONFLICT\*{0,2}[\s\S]*?\n([\s\S]*?)(?=\*{0,2}RESOLUTION|\*{0,2}SETUP|$)/i,
  );
  const r = text.match(
    /\*{0,2}RESOLUTION\*{0,2}[\s\S]*?\n([\s\S]*?)(?=\*{0,2}SETUP|\*{0,2}CONFLICT|$)/i,
  );

  if (s) result.setup = s[1].trim();
  if (c) result.conflict = c[1].trim();
  if (r) result.resolution = r[1].trim();

  if (!result.setup && !result.conflict && !result.resolution) {
    result.setup = text.trim();
  }
  return result;
}
