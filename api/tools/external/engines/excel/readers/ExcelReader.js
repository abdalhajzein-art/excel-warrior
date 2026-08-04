/**
 * excel/readers/ExcelReader.js – Sovereign Unified Excel Reader
 * متوافق بالكامل مع ExcelEngine الموحد وطبقة المحركات الجديدة.
 */

export class ExcelReader {
  constructor(adapter) {
    this.adapter = adapter;
  }

  /* ============================================================
     📖 قراءة كاملة
     ============================================================ */
  async readFull(filePath, params = {}) {
    try {
      console.log(`📖 [ExcelReader] قراءة كاملة للملف: ${filePath}`);

      const core = await this.adapter.read(filePath, params);

      const analysis = this.initialAnalysis(core);
      const summary = this.generateSummary(core, analysis);

      return {
        ok: true,
        reply: core.reply,
        data: {
          sheets: core.data,
          metadata: core.metadata,
          analysis,
          summary
        }
      };
    } catch (err) {
      console.error(`❌ [ExcelReader] خطأ في readFull:`, err);
      return { ok: false, error: err.message, data: null };
    }
  }

  /* ============================================================
     ⚡ قراءة سريعة
     ============================================================ */
  async readFast(filePath, params = {}) {
    try {
      const core = await this.adapter.readFast(filePath, params);
      return { ok: true, data: core };
    } catch (err) {
      return { ok: false, error: err.message, data: null };
    }
  }

  /* ============================================================
     🔍 قراءة ميتاداتا
     ============================================================ */
  async readMetadata(filePath) {
    try {
      const core = await this.adapter.readMetadata(filePath);
      return { ok: true, data: core };
    } catch (err) {
      return { ok: false, error: err.message, data: null };
    }
  }

  /* ============================================================
     🎯 قراءة نطاق محدد
     ============================================================ */
  async readRange(filePath, range, params = {}) {
    try {
      const core = await this.adapter.read(filePath, params);
      const extracted = this.extractRange(core, range);
      return { ok: true, data: extracted };
    } catch (err) {
      return { ok: false, error: err.message, data: null };
    }
  }

  /* ============================================================
     📋 قراءة أوراق محددة
     ============================================================ */
  async readSheets(filePath, sheetNames, params = {}) {
    try {
      const core = await this.adapter.read(filePath, params);
      const filtered = core.data.filter(s => sheetNames.includes(s.name));

      return {
        ok: true,
        data: {
          sheets: filtered,
          metadata: core.metadata
        }
      };
    } catch (err) {
      return { ok: false, error: err.message, data: null };
    }
  }

  /* ============================================================
     📈 تحليل أولي
     ============================================================ */
  initialAnalysis(core) {
    const sheets = core.data || [];
    if (!sheets.length) return {};

    const firstSheet = sheets[0].data || [];
    if (firstSheet.length <= 1) return {};

    const headers = firstSheet[0];
    const analysis = {
      dataTypes: {},
      nullCounts: {},
      uniqueCounts: {},
      suggestions: []
    };

    headers.forEach((header, index) => {
      const columnData = firstSheet.slice(1).map(row => row[index]);
      const nonEmpty = columnData.filter(v => v !== null && v !== undefined && v !== "");

      analysis.dataTypes[header] = this.detectColumnType(columnData);
      analysis.nullCounts[header] = columnData.length - nonEmpty.length;
      analysis.uniqueCounts[header] = new Set(nonEmpty).size;

      if (analysis.nullCounts[header] > columnData.length * 0.3) {
        analysis.suggestions.push(
          `🔍 العمود "${header}" يحتوي على نسبة عالية من القيم الفارغة`
        );
      }

      if (analysis.uniqueCounts[header] <= 10 && analysis.uniqueCounts[header] > 1) {
        analysis.suggestions.push(
          `📋 العمود "${header}" مناسب لقائمة منسدلة (قيم فريدة قليلة)`
        );
      }
    });

    return analysis;
  }

  /* ============================================================
     🔍 كشف نوع العمود
     ============================================================ */
  detectColumnType(data) {
    const nonEmpty = data.filter(v => v !== null && v !== undefined && v !== "");
    if (!nonEmpty.length) return "empty";

    const numbers = nonEmpty.map(v => parseFloat(v)).filter(v => !isNaN(v));
    if (numbers.length === nonEmpty.length) return "number";

    const dates = nonEmpty.map(v => new Date(v)).filter(v => !isNaN(v));
    if (dates.length === nonEmpty.length) return "date";

    const bools = nonEmpty.map(v =>
      ["نعم", "لا", "true", "false", "TRUE", "FALSE"].includes(String(v))
    );
    if (bools.every(b => b)) return "boolean";

    return "text";
  }

  /* ============================================================
     📊 ملخص الملف
     ============================================================ */
  generateSummary(core, analysis) {
    const meta = core.metadata || {};
    const summary = [];

    summary.push(`📊 **ملخص الملف:**`);
    summary.push(`- عدد الأوراق: ${meta.sheets}`);
    summary.push(`- إجمالي الصفوف: ${meta.totalRows}`);
    summary.push(`- إجمالي الأعمدة: ${meta.totalColumns}`);
    summary.push(`- يحتوي على صيغ: ${meta.hasFormulas ? "نعم" : "لا"}`);

    if (analysis.suggestions?.length) {
      summary.push(`\n💡 **اقتراحات:**`);
      analysis.suggestions.forEach(s => summary.push(`- ${s}`));
    }

    return summary.join("\n");
  }

  /* ============================================================
     📐 استخراج نطاق
     ============================================================ */
  extractRange(core, range) {
    const sheets = core.data || [];
    if (!sheets.length) return [];

    const sheet = sheets[0].data || [];

    const [start, end] = range.split(":");
    const startRow = parseInt(start.match(/\d+/)[0], 10);
    const endRow = parseInt(end.match(/\d+/)[0], 10);
    const startCol = start.charCodeAt(0) - 64;
    const endCol = end.charCodeAt(0) - 64;

    const extracted = [];

    for (let r = startRow - 1; r < endRow; r++) {
      const rowData = [];
      for (let c = startCol - 1; c < endCol; c++) {
        rowData.push(sheet[r]?.[c] ?? "");
      }
      extracted.push(rowData);
    }

    return extracted;
  }
}

export default ExcelReader;
