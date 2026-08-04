/**
 * excel/analyzers/ExcelAnalyzer.js – Sovereign Excel Analyzer
 * تحليل سيادي متقدم متوافق مع ExcelEngine الموحد.
 */

export class ExcelAnalyzer {
  constructor(adapter) {
    this.adapter = adapter;
  }

  /**
   * 📊 تحليل كامل للبيانات
   */
  async analyze(filePath, params = {}) {
    const core = await this.adapter.read(filePath, params);

    const statistics = this.calculateStatistics(core);
    const patterns = this.detectPatterns(core);
    const correlations = this.calculateCorrelations(core);
    const report = this.generateReport(statistics, patterns, correlations);
    const insights = this.generateInsights(statistics, patterns);

    return {
      statistics,
      patterns,
      correlations,
      report,
      insights
    };
  }

  /**
   * 📈 حساب الإحصائيات
   */
  calculateStatistics(core) {
    const stats = {
      numeric: {},
      categorical: {},
      overall: {}
    };

    const sheets = core.data || [];
    if (!sheets.length) return stats;

    const firstSheet = sheets[0].data || [];
    if (firstSheet.length <= 1) return stats;

    const headers = firstSheet[0] || [];
    const dataRows = firstSheet.slice(1);

    headers.forEach((header, index) => {
      const values = dataRows
        .map(row => row[index])
        .filter(v => v !== null && v !== undefined);

      const numericValues = values
        .map(v => parseFloat(v))
        .filter(v => !isNaN(v));

      if (numericValues.length === values.length && values.length > 0) {
        stats.numeric[header] = this.numericStats(numericValues);
      } else if (values.length > 0) {
        stats.categorical[header] = this.categoricalStats(values);
      }
    });

    stats.overall = {
      totalRows: dataRows.length,
      totalColumns: headers.length,
      numericColumns: Object.keys(stats.numeric).length,
      categoricalColumns: Object.keys(stats.categorical).length
    };

    return stats;
  }

  /**
   * 📊 إحصائيات رقمية
   */
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

  /**
   * 📊 إحصائيات فئوية
   */
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

  /**
   * 📐 الانحراف المعياري
   */
  standardDeviation(values) {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - avg, 2));
    return Math.sqrt(
      squaredDiffs.reduce((a, b) => a + b, 0) / values.length
    );
  }

  /**
   * 🔍 كشف الأنماط
   */
  detectPatterns(core) {
    const patterns = [];
    const sheets = core.data || [];
    if (!sheets.length) return patterns;

    const firstSheet = sheets[0].data || [];

    const trends = this.detectTrends(firstSheet);
    if (trends.length) patterns.push({ type: "trends", data: trends });

    const duplicates = this.detectDuplicates(firstSheet);
    if (duplicates.length) patterns.push({ type: "duplicates", data: duplicates });

    const outliers = this.detectOutliers(firstSheet);
    if (outliers.length) patterns.push({ type: "outliers", data: outliers });

    return patterns;
  }

  detectTrends(data) {
    // مكان جاهز لتوسعة مستقبلية
    return [];
  }

  detectDuplicates(data) {
    // مكان جاهز لتوسعة مستقبلية
    return [];
  }

  detectOutliers(data) {
    // مكان جاهز لتوسعة مستقبلية
    return [];
  }

  /**
   * 🔗 الارتباطات
   */
  calculateCorrelations(core) {
    // يمكن توسعته لاحقاً لحساب الارتباط بين الأعمدة الرقمية
    return {};
  }

  /**
   * 📝 تقرير
   */
  generateReport(statistics, patterns, correlations) {
    const report = [];
    report.push("# 📊 تقرير تحليل البيانات\n");

    report.push("## 📋 ملخص عام");
    report.push(`- عدد الصفوف: ${statistics.overall?.totalRows || 0}`);
    report.push(`- عدد الأعمدة: ${statistics.overall?.totalColumns || 0}`);
    report.push(`- أعمدة رقمية: ${statistics.overall?.numericColumns || 0}`);
    report.push(
      `- أعمدة فئوية: ${statistics.overall?.categoricalColumns || 0}\n`
    );

    if (Object.keys(statistics.numeric).length) {
      report.push("## 📈 الإحصائيات الرقمية");
      for (const [key, value] of Object.entries(statistics.numeric)) {
        report.push(`### ${key}`);
        report.push(`- المتوسط: ${value.average?.toFixed(2) || "N/A"}`);
        report.push(`- الحد الأدنى: ${value.min ?? "N/A"}`);
        report.push(`- الحد الأقصى: ${value.max ?? "N/A"}`);
        report.push(
          `- الانحراف المعياري: ${value.stdDev?.toFixed(2) || "N/A"}\n`
        );
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

  /**
   * 💡 رؤى
   */
  generateInsights(statistics, patterns) {
    const insights = [];

    if (statistics.numeric) {
      for (const [key, value] of Object.entries(statistics.numeric)) {
        if (value.average > 100) {
          insights.push(
            `💡 متوسط "${key}" مرتفع (${value.average.toFixed(2)})`
          );
        }
        if (value.stdDev > 50) {
          insights.push(
            `💡 تباين كبير في "${key}" (الانحراف المعياري: ${value.stdDev.toFixed(2)})`
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
