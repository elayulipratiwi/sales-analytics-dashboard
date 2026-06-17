async function getInsight(stats, anomalies, question) {
  const categoryList =
    (stats.categories || [])
      .map(
        (c) =>
          c.category +
          " (Margin: " +
          c.margin +
          "%, Sales: $" +
          (+c.sales / 1000).toFixed(0) +
          "K)",
      )
      .join(", ") || "Tidak ada category";

  const categoryNames = (stats.categories || [])
    .map((c) => c.category)
    .join(", ") || "Tidak ada";

  const prompt = `
Anda adalah seorang analis bisnis senior AI. Berdasarkan data sales berikut, jawab pertanyaan dengan bahasa Indonesia yang profesional dan langsung ke poin.

RINGKASAN STATISTIK:
- Total Sales: $${stats.totalSales}
- Total Profit: $${stats.totalProfit}
- Profit Margin: ${stats.overallMargin}%
- Total Orders: ${stats.totalOrders}
- Category Terbaik: ${stats.bestCategory?.category || "N/A"} (Margin ${stats.bestCategory?.margin || "0"}%)
- Category Terburuk: ${stats.worstCategory?.category || "N/A"} (Margin ${stats.worstCategory?.margin || "0"}%)
 ${stats.bestSegment ? "- Segment Terbaik: " + stats.bestSegment.segment + " (Margin " + stats.bestSegment.margin + "%)" : ""}

DAFTAR CATEGORY YANG TERSEDIA:
 ${categoryList}

ANOMALI YANG TERDETEKSI:
- Outlier Profit: ${(anomalies.profitOutliers || []).map((o) => o.name + " (" + o.margin + "%)").join(", ") || "Tidak ada"}
- Perubahan MoM: ${(anomalies.momSpikes || []).map((s) => s.month + " (" + s.changePct + "%)").join(", ") || "Tidak ada"}
- Outlier IQR: ${(anomalies.salesOutliersIQR && anomalies.salesOutliersIQR.totalOutliers) || 0} transaksi ekstrem

PILIHAN CATEGORY (HANYA ini yang ada di data, JANGAN sebut yang lain):
[${categoryNames}]

PERTANYAAN USER: ${question || "Berikan analisis bisnis komprehensif dan rekomendasi dalam bahasa Indonesia."}

ATURAN KRITIS:
- HANYA sebutkan Category dari daftar PILIHAN CATEGORY di atas.
- DILARANG menyebutkan Accessories, Technology, Furniture, atau nama lain yang TIDAK ada di daftar.
- Jika ditanya prioritas, PILIH dari daftar di atas berdasarkan margin tertinggi.
- Gunakan angka spesifik dari data. Langsung ke poin.
`;

  if (CONFIG.AI_PROVIDER === "groq") {
    const response = await fetch(CONFIG.GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + CONFIG.GROQ_API_KEY,
      },
      body: JSON.stringify({
        model: CONFIG.GROQ_MODEL,
        messages: [
          {
            role: "system",
            content:
              "Kamu adalah analis bisnis senior. Bahasa Indonesia. ATURAN: Kamu HANYA boleh menyebutkan Category yang ada di data. Category yang ada HANYALAH: " + categoryNames + ". JANGAN PERNAH menyebutkan Accessories, Technology, Furniture, atau category lain yang tidak ada di daftar itu.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 800,
      }),
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(
        "Groq API error (" +
          response.status +
          "): " +
          (errData.error?.message || response.statusText),
      );
    }
    const data = await response.json();
    return (
      data.choices?.[0]?.message?.content ||
      "Tidak ada insight yang dihasilkan."
    );
  } else {
    const response = await fetch(CONFIG.OLLAMA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: CONFIG.OLLAMA_MODEL,
        prompt: prompt,
        stream: false,
        options: { temperature: 0.1, num_predict: 800 },
      }),
    });
    if (!response.ok)
      throw new Error("Ollama API error (" + response.status + ")");
    const data = await response.json();
    return data.response || "Tidak ada insight yang dihasilkan.";
  }
}
async function narrateAllAlerts(stats, anomalies) {
  const allItems = [
    ...(anomalies.profitOutliers || []),
    ...(anomalies.momSpikes || []).slice(0, 3),
    ...(
      (anomalies.salesOutliersIQR && anomalies.salesOutliersIQR.bySubcat) ||
      []
    ).slice(0, 2),
  ];

  if (allItems.length === 0) return "Tidak ada anomali signifikan terdeteksi.";

  const itemLines = allItems
    .map((a, i) => {
      if (a.type === "profit_outlier")
        return (
          i +
          1 +
          ". [" +
          (a.severity || "WARN").toUpperCase() +
          "] " +
          a.name +
          ": margin " +
          a.margin +
          "% (Z=" +
          a.zScore +
          ")"
        );
      if (a.type === "mom_spike")
        return (
          i +
          1 +
          ". [" +
          (a.severity || "WARN").toUpperCase() +
          "] Revenue " +
          a.month +
          ": " +
          a.changePct +
          "% MoM"
        );
      if (a.type === "iqr_outlier")
        return (
          i +
          1 +
          ". [INFO] Outlier IQR di " +
          a.subcat +
          " (" +
          a.count +
          " transaksi)"
        );
      return "";
    })
    .filter(Boolean)
    .join("\n");

  const prompt = `Kamu adalah analis data bisnis yang memberi alert singkat dan actionable.
Berikut daftar anomali yang terdeteksi di data penjualan:

 ${itemLines}

Untuk setiap anomali, tulis SATU kalimat alert dalam Bahasa Indonesia.
Format per baris: "• [nama/bulan]: [fakta mengejutkan] — [1 rekomendasi kata kerja]"
Urutkan dari paling kritis. Bahasa Indonesia. Langsung list, tanpa preamble.`;

  try {
    return await getInsight(stats, anomalies, prompt);
  } catch (e) {
    return "Gagal generate narasi: " + e.message;
  }
}

async function generateRecommendations(stats, anomalies) {
  const worstCat = stats.worstCategory?.category || "N/A";
  const worstMargin = stats.worstCategory?.margin || "0";
  const bestCat = stats.bestCategory?.category || "N/A";
  const bestMargin = stats.bestCategory?.margin || "0";
  const overallMargin = stats.overallMargin || "0";

  const outlierNames =
    (anomalies.profitOutliers || [])
      .slice(0, 3)
      .map((o) => o.name + " (" + o.margin + "%)")
      .join(", ") || "Tidak ada";

  const momDrops =
    (anomalies.momSpikes || [])
      .filter((s) => s.direction === "drop")
      .slice(0, 2)
      .map(
        (s) =>
          s.month + " -" + Math.abs(parseFloat(s.changePct)).toFixed(0) + "%",
      )
      .join(", ") || "Tidak ada";

  const prompt = `Kamu adalah konsultan bisnis senior. Berdasarkan data ini, berikan 3 rekomendasi tindakan konkret:

DATa AKTIF:
- Total Sales: $${stats.totalSales}, Margin: ${overallMargin}%
- Category Terburuk: ${worstCat} (${worstMargin}%)
- Category Terbaik: ${bestCat} (${bestMargin}%)
- Outlier Margin Rendah: ${outlierNames}
- Penurunan MoM: ${momDrops}

Tulis 3 rekomendasi dalam format JSON array persis seperti ini, tanpa teks lain:
[
  {
    "title": "...(maks 8 kata)...",
    "priority": "high|medium|low",
    "description": "...(1-2 kalimat)...",
    "impact": "...(estimasi dampak singkat)..."
  }
]
Hanya JSON, tanpa markdown code block.`;

  try {
    const raw = await getInsight(stats, anomalies, prompt);
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.warn("AI recommendations failed:", e);
  }
  return null;
}
