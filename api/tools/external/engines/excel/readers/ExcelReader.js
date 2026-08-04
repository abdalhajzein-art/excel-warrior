/**
 * excel/readers/ExcelReader.js – Sovereign Unified Excel Reader (Generalized)
 * قارئ سيادي عام، يعمل فوق أي Adapter (ExcelJS / SheetJS / غيره)،
 * ومتوافق بالكامل مع ExcelEngine الموحد وطبقة المحركات الجديدة.
 */

export class ExcelReader {
  constructor(adapter) {
    this.adapter = adapter;
  }

  /* ============================================================
     📖 قراءة كاملة – تعتمد فقط على واجهة الـ Adapter
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
     ⚡ قراءة سريعة – تدعم Adapters مختلفة
     ============================================================ */
  async readFast(filePath, params = {}) {
    try {
      if (typeof this.adapter.readFast === "function") {
        const core = await this.adapter.readFast(filePath, params);
        return { ok: true, data: core };
      }

      // fallback: استخدام read العادية إذا ما في readFast
      const core = await this.adapter.read(filePath, params);
      return { ok: true, data: core };
    } catch (err) {
      console.error(`❌ [ExcelReader] خطأ في readFast:`, err);
      return { ok: false, error: err.message, data: null };
    }
  }

  /* ============================================================
     🔍 قراءة ميتاداتا – عامة لأي Adapter
     ============================================================ */
  async readMetadata(filePath, params = {}) {
    try {
      if (typeof this.adapter.readMetadata === "function") {
        const core = await this.adapter.readMetadata(filePath, params);
        return { ok: true, data: core };
      }

      // fallback: استنتاج الميتاداتا من readFull
      const core = await this.adapter.read(filePath, params);
      return { ok: true, data: core.metadata || {} };
    } catch (err) {
      console.error(`❌ [ExcelReader] خطأ في readMetadata:`, err);
      return { ok: false, error: err.message, data: null };
    }
  }

  /* ============================================================
     🎯 قراءة نطاق محدد – عامة، بدون افتراض شكل الملف
     ============================================================ */
  async readRange(filePath, range, params = {}) {
    try {
      const core = await this.adapter.read(filePath, params);
      const extracted = this.extractRange(core, range);
      return { ok: true, data: extracted };
    } catch (err) {
      console.error(`❌ [ExcelReader] خطأ في readRange:`, err);
      return { ok: false, error: err.message, data: null };
    }
  }

  /* ============================================================
     📋 قراءة أوراق محددة – عامة لأي محرك
     ============================================================ */
  async readSheets(filePath, sheetNames, params = {}) {
    try {
      const core = await this.adapter.read(filePath, params);
      const filtered = (core.data || []).filter(s => sheetNames.includes(s.name));

      return {
        ok: true,
        data: {
          sheets: filtered,
          metadata: core.metadata
        }
      };
    } catch (err) {
      console.error(`❌ [ExcelReader] خطأ في readSheets:`, err);
      return { ok: false, error: err.message, data: null };
    }
  }

  /* ============================================================
     📈 تحليل أولي – يعمل فوق أي شكل بيانات (ExcelJS / SheetJS)
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
     🔍 كشف نوع العمود – عامة لأي مصدر بيانات
     ============================================================ */
  detectColumnType(data) {
    const nonEmpty = data.filter(v => v !== null && v !== undefined && v !== "");
    if (!nonEmpty.length) return "empty";

    const numbers = nonEmpty.map(v => parseFloat(v)).filter(v => !isNaN(v));
    if (numbers.length === nonEmpty.length) return "number";

    const dates = nonEmpty
      .map(v => (v instanceof Date ? v : new Date(v)))
      .filter(v => !isNaN(v));
    if (dates.length === nonEmpty.length) return "date";

    const bools = nonEmpty.map(v =>
      ["نعم", "لا", "true", "false", "TRUE", "FALSE"].includes(String(v))
    );
    if (bools.every(b => b)) return "boolean";

    return "text";
  }

  /* ============================================================
     📊 ملخص الملف – عام، يعتمد فقط على metadata
     ============================================================ */
  generateSummary(core, analysis) {
    const meta = core.metadata || {};
    const summary = [];

    summary.push(`📊 **ملخص الملف:**`);
    summary.push(`- عدد الأوراق: ${meta.sheets ?? "غير معروف"}`);
    summary.push(`- إجمالي الصفوف: ${meta.totalRows ?? "غير معروف"}`);
    summary.push(`- إجمالي الأعمدة: ${meta.totalColumns ?? "غير معروف"}`);
    summary.push(`- يحتوي على صيغ: ${meta.hasFormulas ? "نعم" : "لا"}`);

    if (analysis.suggestions?.length) {
      summary.push(`\n💡 **اقتراحات:**`);
      analysis.suggestions.forEach(s => summary.push(`- ${s}`));
    }

    return summary.join("\n");
  }

  /* ============================================================
     📐 استخراج نطاق – دعم أعمدة متعددة الأحرف (AA, AB, ...)، عام
     ============================================================ */
  extractRange(core, range) {
    const sheets = core.data || [];
    if (!sheets.length) return [];

    const sheet = sheets[0].data || [];

    const [start, end] = range.split(":");

    const parseCell = (ref) => {
      const match = ref.match(/^([A-Z]+)(\d+)$/i);
      if (!match) return null;
      const [, colLetters, rowStr] = match;
      const row = parseInt(rowStr, 10);

      let col = 0;
      for (let i = 0; i < colLetters.length; i++) {
        col = col * 26 + (colLetters.toUpperCase().charCodeAt(i) - 64);
      }

      return { row, col };
    };

    const startCell = parseCell(start);
    const endCell = parseCell(end);
    if (!startCell || !endCell) return [];

    const extracted = [];

    for (let r = startCell.row - 1; r < endCell.row; r++) {
      const rowData = [];
      for (let c = startCell.col - 1; c < endCell.col; c++) {
        rowData.push(sheet[r]?.[c] ?? "");
      }
      extracted.push(rowData);
    }

    return extracted;
  }
}

export default ExcelReader;
