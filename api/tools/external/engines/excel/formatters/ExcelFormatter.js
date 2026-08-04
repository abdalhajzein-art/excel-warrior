/**
 * api/tools/external/engines/excel/formatters/ExcelFormatter.js
 * Sovereign Unified Excel Formatter (Enterprise Edition)
 * منسق سيادي ذكي، يتكامل مع الرادار، يدعم الأعمدة اللانهائية، ويعتمد هوية الأثير البصرية.
 */

import { ExcelTableDetector } from "../core/ExcelTableDetector.js";

export class ExcelFormatter {
  constructor(adapter) {
    this.adapter = adapter;
  }

  /* ============================================================
     🎨 التنسيق التلقائي الذكي (Auto-Format)
     ============================================================ */
  async autoFormat(filePath, params = {}) {
    const core = await this.adapter.read(filePath, params);
    let allOperations = [];

    const sheets = core.data || [];
    
    // نمر على كل ورقة، ونستخرج النطاق الحقيقي، ثم نبني عمليات التنسيق دفعة واحدة
    for (const sheet of sheets) {
      const tableInfo = ExcelTableDetector.detectMainTable(sheet);
      if (!tableInfo) continue; // تخطي الأوراق الفارغة

      const sheetOps = this.buildSheetFormattingOps(sheet.data, tableInfo, sheet.name);
      allOperations = allOperations.concat(sheetOps);
    }

    if (allOperations.length === 0) {
      return { ok: false, error: "لم يتم العثور على جداول قابلة للتنسيق في الملف." };
    }

    // 🚀 تنفيذ التعديلات عبر المحرك
    const result = await this.adapter.modify(filePath, { operations: allOperations });

    return {
      ...result,
      summary: this.generateFormatSummary(allOperations),
      operationsApplied: allOperations.length
    };
  }

  /* ============================================================
     🏗️ بناء عمليات التنسيق لورقة محددة (Single Pass Optimization)
     ============================================================ */
  buildSheetFormattingOps(data, tableInfo, sheetName) {
    const ops = [];
    const { headerRowNum, dataStartRow, dataEndRow, totalCols } = tableInfo;
    
    const firstColLetter = "A"; // افتراضياً نبدأ من A (يمكن تطويرها لاحقاً لتبدأ من النطاق المكتشف)
    const lastColLetter = this.getExcelColumnLetter(totalCols - 1);
    
    const headerRowIdx = headerRowNum - 1;
    const headers = data[headerRowIdx] || [];
    const dataRows = data.slice(dataStartRow - 1, dataEndRow);

    // 1. 🖌️ تنسيق الرؤوس (هوية الأثير: أسود وذهبي)
    ops.push({
      type: "format_range",
      sheet: sheetName,
      range: `${firstColLetter}${headerRowNum}:${lastColLetter}${headerRowNum}`,
      style: {
        fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF111111" } }, // أسود داكن
        font: { bold: true, color: { argb: "FFD4AF37" }, size: 12 }, // ذهبي
        alignment: { horizontal: "center", vertical: "middle" },
        border: { bottom: { style: "medium", color: { argb: "FFD4AF37" } } }
      }
    });

    // 2. 🔲 تنسيق حدود الجدول بالكامل وتفعيل الفلتر
    ops.push({
      type: "format_range",
      sheet: sheetName,
      range: `${firstColLetter}${headerRowNum}:${lastColLetter}${dataEndRow}`,
      style: {
        border: {
          top: { style: "thin" }, bottom: { style: "thin" },
          left: { style: "thin" }, right: { style: "thin" }
        }
      }
    });

    ops.push({
      type: "add_filter",
      sheet: sheetName,
      from: `${firstColLetter}${headerRowNum}`,
      to: `${lastColLetter}${dataEndRow}`
    });

    // 3. 🏁 تلوين الصفوف المتعاقبة (Zebra Striping)
    for (let r = dataStartRow; r <= dataEndRow; r++) {
      if (r % 2 === 0) {
        ops.push({
          type: "format_range",
          sheet: sheetName,
          range: `${firstColLetter}${r}:${lastColLetter}${r}`,
          style: {
            fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9F9F9" } }
          }
        });
      }
    }

    // 4. 🧠 التنسيق الذكي حسب نوع البيانات (Data-Type Formatting)
    headers.forEach((header, index) => {
      if (index >= totalCols) return;
      
      const colLetter = this.getExcelColumnLetter(index);
      const colData = dataRows.map(r => r[index]).filter(v => v !== null && v !== undefined && String(v).trim() !== "");
      
      const type = this.detectStrictColumnType(colData);
      
      // المحاذاة حسب النوع
      let alignment = "left";
      if (type === "number") alignment = "right";
      if (type === "date" || type === "boolean") alignment = "center";

      ops.push({
        type: "format_range",
        sheet: sheetName,
        range: `${colLetter}${dataStartRow}:${colLetter}${dataEndRow}`,
        style: { alignment: { horizontal: alignment } }
      });

      // 5. 🎯 التنسيق الشرطي (لأعمدة الأرقام فقط وتجنب الفوضى البصرية)
      if (type === "number" && colData.length > 2) {
        const numeric = colData.map(v => parseFloat(v));
        const avg = numeric.reduce((a, b) => a + b, 0) / numeric.length;
        
        // استخدام ألوان هادئة لتحديد الأرقام التي تتجاوز/تقل عن المتوسط
        ops.push({
          type: "color_cells",
          sheet: sheetName,
          range: `${colLetter}${dataStartRow}:${colLetter}${dataEndRow}`,
          condition: `> ${avg}`,
          color: "FFE6F4EA", // خلفية خضراء باهتة
          textColor: "FF137333" // نص أخضر داكن
        });
      }
    });

    return ops;
  }

  /* ============================================================
     🧮 تحويل الرقم إلى حرف عمود الإكسل (يدعم AA, AB, XFD)
     ============================================================ */
  getExcelColumnLetter(index) {
    let temp, letter = '';
    let col = index + 1; // الإكسل يبدأ من 1
    while (col > 0) {
      temp = (col - 1) % 26;
      letter = String.fromCharCode(temp + 65) + letter;
      col = (col - temp - 1) / 26;
    }
    return letter;
  }

  /* ============================================================
     🔍 كشف نوع العمود الصارم
     ============================================================ */
  detectStrictColumnType(nonEmptyData) {
    if (!nonEmptyData.length) return "empty";

    const isNumber = (v) => !isNaN(parseFloat(v)) && isFinite(v);
    if (nonEmptyData.every(isNumber)) return "number";

    const boolValues = new Set(["نعم", "لا", "true", "false", "1", "0"]);
    if (nonEmptyData.every(v => boolValues.has(String(v).trim().toLowerCase()))) return "boolean";

    const isDate = nonEmptyData.every(v => {
      if (v instanceof Date) return true;
      if (isNumber(v)) return false;
      const dateRegex = /^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/;
      return dateRegex.test(String(v).trim()) && !isNaN(Date.parse(v));
    });
    if (isDate) return "date";

    return "text";
  }

  /* ============================================================
     📊 ملخص التنسيق
     ============================================================ */
  generateFormatSummary(operations) {
    const counts = {};
    operations.forEach(op => { counts[op.type] = (counts[op.type] || 0) + 1; });

    const summary = ["🎨 **تم تطبيق التنسيق السيادي (نمط الأثير):**"];
    for (const [type, count] of Object.entries(counts)) {
      summary.push(`- عملية [${type}]: ${count} مرة.`);
    }
    return summary.join("\n");
  }
}

export default ExcelFormatter;

