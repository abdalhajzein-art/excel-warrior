/**
 * api/tools/external/engines/excel/analyzers/ExcelAnalyzer.js
 * Sovereign Excel Analyzer (Data Science Edition - Alatheer AI Suite)
 * محلل سيادي واعي سياقياً، يدمج كشف الجداول، الارتباطات الرياضية، والقيم الشاذة.
 */

import { ExcelTableDetector } from "../core/ExcelTableDetector.js";

export class ExcelAnalyzer {
  constructor(adapter) {
    this.adapter = adapter;
  }

  async analyze(filePath, params = {}) {
    // 📖 القراءة الآمنة عبر المحرك
    const core = await this.adapter.read(filePath, params);

    // 🧠 التحليل متعدد المراحل
    const statistics = this.calculateStatistics(core);
    const correlations = this.calculateCorrelations(statistics, core);
    const patterns = this.detectPatterns(statistics);
    
    // 📊 توليد المخرجات للـ Agent
    const report = this.generateReport(statistics, patterns, correlations);
    const insights = this.generateInsights(statistics, patterns, correlations);

    return { ok: true, statistics, patterns, correlations, report, insights };
  }

  /* ============================================================
     📈 الإحصائيات المتقدمة (مدعومة بالرادار السيادي)
     ============================================================ */
  calculateStatistics(core) {
    const stats = {
      sheets: {},
      overall: { totalRows: 0, totalColumns: 0, numericColumns: 0, categoricalColumns: 0 }
    };

    const sheets = core.data || [];
    if (!sheets.length) return stats;

    for (const sheet of sheets) {
      const data = sheet.data || [];
      if (!data.length) continue;

      // 🎯 استخدام الرادار لاستخراج النطاق الحقيقي
      const tableInfo = ExcelTableDetector.detectMainTable(sheet);
      if (!tableInfo) continue;

      const headerRowIndex = tableInfo.headerRowNum - 1;
      const headers = data[headerRowIndex] || [];
      // اقتطاع البيانات الحقيقية فقط
      const dataRows = data.slice(tableInfo.dataStartRow - 1, tableInfo.dataEndRow);

      const sheetStats = {
        numeric: {},
        categorical: {},
        totalRows: dataRows.length,
        totalColumns: headers.length,
        rawData: {} // للاستخدام في حساب الارتباطات لاحقاً
      };

      headers.forEach((header, index) => {
        const headerName = String(header || `Column_${index + 1}`).trim();
        
        const rawValues = dataRows.map(row => row[index]);
        const validValues = rawValues.filter(v => v !== null && v !== undefined && String(v).trim() !== "");

        if (!validValues.length) return;

        const numericValues = validValues.map(v => parseFloat(v)).filter(v => !isNaN(v));
        const numericRatio = numericValues.length / validValues.length;

        if (numericRatio >= 0.7) { // إذا كان 70% أو أكثر من البيانات أرقاماً
          sheetStats.numeric[headerName] = this.numericStats(numericValues);
          sheetStats.rawData[headerName] = numericValues; // حفظها لمصفوفة الارتباط
        } else {
          sheetStats.categorical[headerName] = this.categoricalStats(validValues);
        }
      });

      sheetStats.numericColumns = Object.keys(sheetStats.numeric).length;
      sheetStats.categoricalColumns = Object.keys(sheetStats.categorical).length;

      stats.sheets[sheet.name] = sheetStats;
      stats.overall.totalRows += sheetStats.totalRows;
      stats.overall.totalColumns = Math.max(stats.overall.totalColumns, sheetStats.totalColumns);
      stats.overall.numericColumns += sheetStats.numericColumns;
      stats.overall.categoricalColumns += sheetStats.categoricalColumns;
    }

    return stats;
  }

  numericStats(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    const count = values.length;
    const avg = sum / count;
    
    // حساب الأرباع (Quartiles) لاكتشاف القيم الشاذة (IQR)
    const q1 = sorted[Math.floor(count * 0.25)];
    const q3 = sorted[Math.floor(count * 0.75)];
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    
    const outliers = sorted.filter(v => v < lowerBound || v > upperBound);

    return {
      count,
      sum,
      average: avg,
      min: sorted[0],
      max: sorted[count - 1],
      median: sorted[Math.floor(count / 2)],
      stdDev: this.standardDeviation(values, avg),
      outliersCount: outliers.length
    };
  }

  categoricalStats(values) {
    const counts = {};
    values.forEach(v => {
      const key = String(v).trim();
      counts[key] = (counts[key] || 0) + 1;
    });

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    
    // الاكتفاء بأعلى 5 قيم لتوفير التوكنز والذاكرة
    const top5 = Object.fromEntries(sorted.slice(0, 5));

    return {
      count: values.length,
      uniqueValues: sorted.length,
      mostCommon: sorted[0] ? { value: sorted[0][0], count: sorted[0][1] } : null,
      topDistribution: top5
    };
  }

  standardDeviation(values, avg) {
    const squaredDiffs = values.map(v => Math.pow(v - avg, 2));
    return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
  }

  /* ============================================================
     🔗 حساب الارتباطات (Pearson Correlation)
     ============================================================ */
  calculateCorrelations(statistics) {
    const correlations = {};

    for (const [sheetName, sheetStats] of Object.entries(statistics.sheets)) {
      const numericKeys = Object.keys(sheetStats.rawData || {});
      if (numericKeys.length < 2) continue;

      correlations[sheetName] = [];

      for (let i = 0; i < numericKeys.length; i++) {
        for (let j = i + 1; j < numericKeys.length; j++) {
          const colX = numericKeys[i];
          const colY = numericKeys[j];
          
          const xValues = sheetStats.rawData[colX];
          const yValues = sheetStats.rawData[colY];

          // ضمان نفس الطول للحساب
          const minLen = Math.min(xValues.length, yValues.length);
          const xSlice = xValues.slice(0, minLen);
          const ySlice = yValues.slice(0, minLen);

          const r = this.pearsonCorrelation(xSlice, ySlice);
          
          if (Math.abs(r) >= 0.5) { // حفظ الارتباطات القوية أو المتوسطة فقط (أكبر من 0.5 أو أقل من -0.5)
            correlations[sheetName].push({
              col1: colX,
              col2: colY,
              score: r.toFixed(2),
              type: r > 0 ? "طردي (إيجابي)" : "عكسي (سلبي)"
            });
          }
        }
      }
      
      // إزالة البيانات الخام لتنظيف المخرجات
      delete sheetStats.rawData;
    }
    return correlations;
  }

  pearsonCorrelation(x, y) {
    const n = x.length;
    if (n === 0) return 0;
    
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumX2 = x.reduce((a, b) => a + b * b, 0);
    const sumY2 = y.reduce((a, b) => a + b * b, 0);
    const sumXY = x.reduce((a, b, i) => a + b * y[i], 0);

    const numerator = (n * sumXY) - (sumX * sumY);
    const denominator = Math.sqrt(((n * sumX2) - (sumX * sumX)) * ((n * sumY2) - (sumY * sumY)));
    
    return denominator === 0 ? 0 : numerator / denominator;
  }

  /* ============================================================
     🔍 استكشاف الأنماط (Patterns)
     ============================================================ */
  detectPatterns(statistics) {
    const patterns = [];
    for (const [sheetName, sheetStats] of Object.entries(statistics.sheets)) {
      // كشف الأعمدة ذات القيم الثابتة
      for (const [key, value] of Object.entries(sheetStats.categorical)) {
        if (value.uniqueValues === 1) {
          patterns.push({ sheet: sheetName, type: "Constant Column", column: key, description: `العمود يحتوي على قيمة واحدة فقط: ${value.mostCommon.value}` });
        }
        // كشف الأعمدة التي تصلح كمفاتيح أساسية (IDs)
        if (value.uniqueValues === value.count && value.count > 10) {
          patterns.push({ sheet: sheetName, type: "Unique ID Column", column: key, description: "جميع القيم فريدة، قد يكون هذا العمود معرّفاً (ID)." });
        }
      }
    }
    return patterns;
  }

  /* ============================================================
     📄 توليد تقرير Markdown للوكيل (Agent)
     ============================================================ */
  generateReport(statistics, patterns, correlations) {
    const report = ["# 📊 التقرير التحليلي السيادي (Alatheer AI Suite)\n"];

    report.push("## 📋 الملخص التنفيذي");
    report.push(`- **إجمالي الصفوف المحللة:** ${statistics.overall.totalRows}`);
    report.push(`- **الأعمدة الرقمية:** ${statistics.overall.numericColumns} | **الفئوية:** ${statistics.overall.categoricalColumns}\n`);

    for (const [sheetName, sheetStats] of Object.entries(statistics.sheets)) {
      report.push(`## 📄 ورقة العمل: [${sheetName}]`);
      
      if (Object.keys(sheetStats.numeric).length) {
        report.push("### 📈 التحليل الرقمي");
        for (const [key, value] of Object.entries(sheetStats.numeric)) {
          report.push(`- **${key}:** متوسط (${value.average?.toFixed(2)}), نطاق (${value.min} ↔ ${value.max}) ${value.outliersCount > 0 ? `🚨 [${value.outliersCount} قيم شاذة]` : ""}`);
        }
      }

      if (Object.keys(sheetStats.categorical).length) {
        report.push("\n### 📊 التحليل الفئوي");
        for (const [key, value] of Object.entries(sheetStats.categorical)) {
          report.push(`- **${key}:** ${value.uniqueValues} قيم فريدة. الأبرز: "${value.mostCommon?.value}" (${value.mostCommon?.count} تكرار)`);
        }
      }

      const sheetCorrelations = correlations[sheetName] || [];
      if (sheetCorrelations.length) {
        report.push("\n### 🔗 ارتباطات ملحوظة (Pearson)");
        sheetCorrelations.forEach(c => {
          report.push(`- ارتباط **${c.type}** (${c.score}) بين [${c.col1}] و [${c.col2}]`);
        });
      }
      report.push("---\n");
    }
    return report.join("\n");
  }

  /* ============================================================
     💡 توليد الاستنتاجات الذكية (Insights)
     ============================================================ */
  generateInsights(statistics, patterns, correlations) {
    const insights = [];

    // استنتاجات القيم الشاذة
    for (const [sheetName, sheetStats] of Object.entries(statistics.sheets)) {
      for (const [key, value] of Object.entries(sheetStats.numeric)) {
        if (value.outliersCount > 0) {
          insights.push(`🚨 [${sheetName}]: تم رصد ${value.outliersCount} قيم شاذة (Outliers) في عمود "${key}" تتجاوز النطاق الطبيعي.`);
        }
      }
    }

    // استنتاجات الارتباط
    Object.entries(correlations).forEach(([sheet, corrs]) => {
      corrs.forEach(c => {
        if (Math.abs(parseFloat(c.score)) >= 0.8) {
          insights.push(`🔗 [${sheet}]: علاقة قوية جداً (${c.score}) بين "${c.col1}" و "${c.col2}". تغيير أحدهما سيؤثر غالباً على الآخر.`);
        }
      });
    });

    // استنتاجات الأنماط
    patterns.forEach(p => insights.push(`💡 [${p.sheet}]: ${p.description} (العمود: ${p.column})`));

    return insights.length ? insights : ["✔️ البيانات تبدو متجانسة ولا توجد أنماط شاذة ملحوظة."];
  }
}

export default ExcelAnalyzer;

