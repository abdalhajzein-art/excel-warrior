/**
 * excel/analyzers/ExcelAnalyzer.js – Sovereign Excel Analyzer (Generalized)
 * تحليل سيادي متقدم، يدعم تعدد الأوراق، ومتوافق مع ExcelEngine الموحد.
 */

export class ExcelAnalyzer {
  constructor(adapter) {
    this.adapter = adapter;
  }

  async analyze(filePath, params = {}) {
    const core = await this.adapter.read(filePath, params);

    const statistics = this.calculateStatistics(core);
    const patterns = this.detectPatterns(core);
    const correlations = this.calculateCorrelations(core);
    const report = this.generateReport(statistics, patterns, correlations);
    const insights = this.generateInsights(statistics, patterns);

    return { statistics, patterns, correlations, report, insights };
  }

  /* ============================================================
     📈 حساب الإحصائيات – على كل الأوراق، مع تجميع
     ============================================================ */
  calculateStatistics(core) {
    const stats = {
      sheets: {},
      overall: {
        totalRows: 0,
        totalColumns: 0,
        numericColumns: 0,
        categoricalColumns: 0
      }
    };

    const sheets = core.data || [];
    if (!sheets.length) return stats;

    for (const sheet of sheets) {
      const name = sheet.name || "Sheet";
      const data = sheet.data || [];
      if (data.length <= 1) continue;

      const headers = data[0] || [];
      const dataRows = data.slice(1);

      const sheetStats = {
        numeric: {},
        categorical: {},
        totalRows: dataRows.length,
        totalColumns: headers.length
      };

      headers.forEach((header, index) => {
        const values = dataRows
          .map(row => row[index])
          .filter(v => v !== null && v !== undefined && v !== "");

        if (!values.length) return;

        const numericValues = values
          .map(v => parseFloat(v))
          .filter(v => !isNaN(v));

        const numericRatio = numericValues.length / values.length;

        if (numericRatio >= 0.7) {
          sheetStats.numeric[header] = this.numericStats(numericValues);
        } else {
          sheetStats.categorical[header] = this.categoricalStats(values);
        }
      });

      sheetStats.numericColumns = Object.keys(sheetStats.numeric).length;
      sheetStats.categoricalColumns = Object.keys(sheetStats.categorical).length;

      stats.sheets[name] = sheetStats;

      stats.overall.totalRows += sheetStats.totalRows;
      stats.overall.totalColumns = Math.max(
        stats.overall.totalColumns,
        sheetStats.totalColumns
      );
      stats.overall.numericColumns += sheetStats.numericColumns;
      stats.overall.categoricalColumns += sheetStats.categoricalColumns;
    }

    return stats;
  }

  numericStats(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;

    return {
      count: values.length,
      sum,
      average: avg,
      min: Math.min(...values),
      max: Math.max(...values),
      median: sorted[Math.floor(sorted.length / 2)],
      stdDev: this.standardDeviation(values)
    };
  }

  categoricalStats(values) {
    const counts = {};
    values.forEach(v => {
      const key = String(v);
      counts[key] = (counts[key] || 0) + 1;
    });

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

    return {
      count: values.length,
      uniqueValues: Object.keys(counts).length,
      mostCommon: sorted[0]
        ? { value: sorted[0][0], count: sorted[0][1] }
        : null,
      leastCommon: sorted[sorted.length - 1]
        ? { value: sorted[sorted.length - 1][0], count: sorted[sorted.length - 1][1] }
        : null,
      distribution: counts
    };
  }

  standardDeviation(values) {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - avg, 2));
    return Math.sqrt(
      squaredDiffs.reduce((a, b) => a + b, 0) / values.length
    );
  }

  /* ============================================================
     🔍 الأنماط – حالياً بسيطة، جاهزة للتوسعة
     ============================================================ */
  detectPatterns(core) {
    const patterns = [];
    const sheets = core.data || [];
    if (!sheets.length) return patterns;

    // ممكن لاحقاً نستخدم TableDetector هنا
    return patterns;
  }

  calculateCorrelations(core) {
    // مكان جاهز لتوسعة لاحقة للارتباطات بين الأعمدة الرقمية
    return {};
  }

  generateReport(statistics, patterns, correlations) {
    const report = [];
    report.push("# 📊 تقرير تحليل البيانات\n");

    report.push("## 📋 ملخص عام");
    report.push(`- إجمالي الصفوف: ${statistics.overall.totalRows}`);
    report.push(`- أكبر عدد أعمدة في ورقة: ${statistics.overall.totalColumns}`);
    report.push(`- إجمالي الأعمدة الرقمية: ${statistics.overall.numericColumns}`);
    report.push(`- إجمالي الأعمدة الفئوية: ${statistics.overall.categoricalColumns}\n`);

    for (const [sheetName, sheetStats] of Object.entries(statistics.sheets)) {
      report.push(`## 📄 الورقة: ${sheetName}`);
      report.push(
        `- الصفوف: ${sheetStats.totalRows}, الأعمدة: ${sheetStats.totalColumns}`
      );

      if (Object.keys(sheetStats.numeric).length) {
        report.push("### 📈 الأعمدة الرقمية");
        for (const [key, value] of Object.entries(sheetStats.numeric)) {
          report.push(`#### ${key}`);
          report.push(`- المتوسط: ${value.average?.toFixed(2) || "N/A"}`);
          report.push(`- الحد الأدنى: ${value.min ?? "N/A"}`);
          report.push(`- الحد الأقصى: ${value.max ?? "N/A"}`);
          report.push(
            `- الانحراف المعياري: ${value.stdDev?.toFixed(2) || "N/A"}\n`
          );
        }
      }

      if (Object.keys(sheetStats.categorical).length) {
        report.push("### 📊 الأعمدة الفئوية");
        for (const [key, value] of Object.entries(sheetStats.categorical)) {
          report.push(`#### ${key}`);
          report.push(
            `- عدد القيم: ${value.count}, عدد القيم الفريدة: ${value.uniqueValues}`
          );
          if (value.mostCommon) {
            report.push(
              `- الأكثر شيوعاً: "${value.mostCommon.value}" (${value.mostCommon.count})`
            );
          }
          report.push("");
        }
      }
    }

    if (patterns.length) {
      report.push("## 🔍 الأنماط المكتشفة");
      for (const pattern of patterns) {
        report.push(`### ${pattern.type}`);
        report.push(`- ${JSON.stringify(pattern.data)}\n`);
      }
    }

    return report.join("\n");
  }

  generateInsights(statistics, patterns) {
    const insights = [];

    for (const [sheetName, sheetStats] of Object.entries(statistics.sheets)) {
      for (const [key, value] of Object.entries(sheetStats.numeric)) {
        if (value.average > 100) {
          insights.push(
            `💡 في الورقة "${sheetName}"، متوسط "${key}" مرتفع (${value.average.toFixed(2)})`
          );
        }
        if (value.stdDev > 50) {
          insights.push(
            `💡 في الورقة "${sheetName}"، تباين كبير في "${key}" (الانحراف المعياري: ${value.stdDev.toFixed(2)})`
          );
        }
      }
    }

    for (const pattern of patterns) {
      if (pattern.type === "duplicates" && pattern.data.length) {
        insights.push(`🔍 تم العثور على ${pattern.data.length} صف مكرر`);
      }
      if (pattern.type === "outliers" && pattern.data.length) {
        insights.push(`🚨 تم العثور على ${pattern.data.length} قيمة شاذة`);
      }
    }

    return insights;
  }
                      }
