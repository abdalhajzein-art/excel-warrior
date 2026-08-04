/**
 * api/tools/external/engines/excel/readers/ExcelReader.js
 * Sovereign Unified Excel Reader (Scout Edition - Alatheer AI Suite)
 * كشاف سيادي سريع، يستعين بالرادار لتجاوز الشوائب، ويولد بروفايل دقيق للبيانات.
 */

import { ExcelTableDetector } from "../core/ExcelTableDetector.js";

export class ExcelReader {
  constructor(adapter) {
    this.adapter = adapter; // يقبل أي محرك سيادي (SheetJS غالباً للسرعة)
  }

  /* ============================================================
     📖 قراءة كاملة مع مسح أولي (Scouting)
     ============================================================ */
  async readFull(filePathOrBuffer, params = {}) {
    try {
      console.log(`📖 [ExcelReader] جاري الاستكشاف السيادي للملف...`);

      const core = await this.adapter.read(filePathOrBuffer, params);

      // الاستعانة بالرادار لتوليد تحليل هيكلي دقيق
      const analysis = this.initialAnalysis(core);
      const summary = this.generateSummary(core, analysis);

      return {
        ok: true,
        reply: "تمت قراءة الملف بنجاح وتوليد بروفايل الهيكلية.",
        data: {
          sheets: core.data,
          metadata: core.metadata,
          analysis,
          summary
        }
      };
    } catch (err) {
      console.error(`❌ [ExcelReader] انهيار في readFull:`, err);
      return { ok: false, error: err.message, data: null };
    }
  }

  /* ============================================================
     ⚡ قراءة سريعة (Raw Data Only)
     ============================================================ */
  async readFast(filePathOrBuffer, params = {}) {
    try {
      if (typeof this.adapter.readFast === "function") {
        const core = await this.adapter.readFast(filePathOrBuffer, params);
        return { ok: true, data: core };
      }
      const core = await this.adapter.read(filePathOrBuffer, params);
      return { ok: true, data: core };
    } catch (err) {
      return { ok: false, error: err.message, data: null };
    }
  }

  /* ============================================================
     🎯 قراءة نطاق محدد (يدعم صيغة Sheet1!A1:B10)
     ============================================================ */
  async readRange(filePathOrBuffer, range, params = {}) {
    try {
      const core = await this.adapter.read(filePathOrBuffer, params);
      const extracted = this.extractRange(core, range);
      return { 
        ok: true, 
        reply: `تم استخراج النطاق ${range} بنجاح.`,
        data: extracted 
      };
    } catch (err) {
      console.error(`❌ [ExcelReader] خطأ في readRange:`, err);
      return { ok: false, error: err.message, data: null };
    }
  }

  /* ============================================================
     📈 التحليل الأولي السيادي (بمساعدة الرادار)
     ============================================================ */
  initialAnalysis(core) {
    const sheets = core.data || [];
    if (!sheets.length) return {};

    const analysis = {};

    // نحلل فقط الأوراق التي تحتوي على بيانات لتوفير التوكنز
    for (const sheet of sheets) {
      const data = sheet.data || [];
      if (data.length <= 1) continue;

      const tableInfo = ExcelTableDetector.detectMainTable(sheet);
      if (!tableInfo) continue;

      const headerRowIndex = tableInfo.headerRowNum - 1;
      const headers = data[headerRowIndex] || [];
      const dataRows = data.slice(tableInfo.dataStartRow - 1, tableInfo.dataEndRow);

      const sheetAnalysis = {
        dataTypes: {},
        nullCounts: {},
        uniqueCounts: {},
        suggestions: []
      };

      headers.forEach((header, index) => {
        const headerName = String(header || `Column_${index + 1}`).trim();
        const columnData = dataRows.map(row => row[index]);
        const nonEmpty = columnData.filter(v => v !== null && v !== undefined && String(v).trim() !== "");

        sheetAnalysis.dataTypes[headerName] = this.detectColumnType(nonEmpty);
        sheetAnalysis.nullCounts[headerName] = columnData.length - nonEmpty.length;
        sheetAnalysis.uniqueCounts[headerName] = new Set(nonEmpty).size;

        // توليد نصائح ذكية للـ Agent
        if (sheetAnalysis.nullCounts[headerName] > columnData.length * 0.3 && columnData.length > 5) {
          sheetAnalysis.suggestions.push(`⚠️ العمود "${headerName}" يحتوي على فراغات تتجاوز 30% (تحتاج تنظيف)`);
        }

        if (sheetAnalysis.uniqueCounts[headerName] <= 5 && nonEmpty.length > 10) {
          sheetAnalysis.suggestions.push(`💡 العمود "${headerName}" مثالي للتحويل إلى قائمة منسدلة (Data Validation)`);
        }
      });

      analysis[sheet.name] = sheetAnalysis;
    }

    return analysis;
  }

  /* ============================================================
     🔍 كشف نوع العمود - فلتر صارم
     ============================================================ */
  detectColumnType(nonEmptyData) {
    if (!nonEmptyData.length) return "empty";

    const isNumber = (v) => !isNaN(parseFloat(v)) && isFinite(v);
    
    // فحص الأرقام
    if (nonEmptyData.every(isNumber)) return "number";

    // فحص المنطق (Booleans)
    const boolValues = new Set(["نعم", "لا", "true", "false", "1", "0", "TRUE", "FALSE"]);
    const isBool = nonEmptyData.every(v => boolValues.has(String(v).trim().toLowerCase()));
    if (isBool) return "boolean";

    // فحص التواريخ (تجنب الأرقام العادية التي تحسب كتواريخ بالخطأ)
    const isDate = nonEmptyData.every(v => {
      if (v instanceof Date) return true;
      if (isNumber(v)) return false; // الأرقام ليست تواريخ نصية
      const str = String(v).trim();
      // نمط بسيط للتواريخ الشائعة 2023-01-01 أو 01/01/2023
      const dateRegex = /^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/;
      return dateRegex.test(str) && !isNaN(Date.parse(str));
    });

    if (isDate) return "date";

    return "text";
  }

  /* ============================================================
     📊 ملخص الملف (موجه للـ Prompt)
     ============================================================ */
  generateSummary(core, analysis) {
    const meta = core.metadata || {};
    const summary = [];

    summary.push(`📊 **الهوية الهيكلية للملف:**`);
    summary.push(`- الأوراق (${meta.sheets}): ${meta.sheetNames?.join(", ")}`);
    summary.push(`- إجمالي الصفوف: ${meta.totalRows} | الأعمدة: ${meta.totalColumns}`);
    
    const allSuggestions = [];
    Object.values(analysis).forEach(sheetProfile => {
      if (sheetProfile.suggestions) allSuggestions.push(...sheetProfile.suggestions);
    });

    if (allSuggestions.length) {
      summary.push(`\n💡 **ملاحظات هيكلية سريعة:**`);
      // إرسال أهم 5 نصائح فقط لتوفير التوكنز
      allSuggestions.slice(0, 5).forEach(s => summary.push(`- ${s}`));
    }

    return summary.join("\n");
  }

  /* ============================================================
     📐 استخراج نطاق آمن (يدعم Sheet1!A1:C10)
     ============================================================ */
  extractRange(core, rangeStr) {
    const sheets = core.data || [];
    if (!sheets.length) return [];

    let targetSheet = sheets[0].data || [];
    let rangeCoords = rangeStr;

    // دعم استهداف ورقة محددة
    if (rangeStr.includes("!")) {
      const parts = rangeStr.split("!");
      const sheetName = parts[0].replace(/['"]/g, ''); // إزالة علامات التنصيص إن وجدت
      rangeCoords = parts[1];
      
      const foundSheet = sheets.find(s => s.name === sheetName);
      if (foundSheet) targetSheet = foundSheet.data;
    }

    const [start, end] = rangeCoords.split(":");
    if (!start || !end) throw new Error("صيغة النطاق غير صالحة. استخدم A1:B10");

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
    if (!startCell || !endCell) throw new Error("تعذر تحليل إحداثيات النطاق.");

    const extracted = [];
    // Indexing: الجداول البرمجية تبدأ من 0
    for (let r = startCell.row - 1; r < endCell.row; r++) {
      const rowData = [];
      for (let c = startCell.col - 1; c < endCell.col; c++) {
        rowData.push(targetSheet[r]?.[c] ?? "");
      }
      extracted.push(rowData);
    }

    return extracted;
  }
}

export default ExcelReader;

