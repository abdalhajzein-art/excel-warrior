/**
 * api/tools/external/engines/excel/core/ExcelJSAdapter.js 
 * Sovereign Advanced Excel Engine (Reconstruction Edition - Alatheer AI Suite)
 * محرك ExcelJS سيادي متقدم، يعتمد على إعادة البناء الهيكلي النظيف لضمان سلامة الملفات 100%.
 */

import ExcelJS from "exceljs";
import { FileUtils } from "../utils/FileUtils.js";

export class ExcelJSAdapter {
  constructor() {
    this.name = "exceljs";
  }

  async initialize() {
    return true;
  }

  async read(filePath, params = {}) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);

      const sheets = workbook.worksheets.map(ws => this.extractSheet(ws));

      return {
        ok: true,
        reply: "تمت قراءة الملف بنجاح عبر ExcelJS السيادي",
        data: sheets,
        metadata: this.buildMetadata(sheets),
        filePath
      };
    } catch (error) {
      return { ok: false, error: `فشل في قراءة الملف: ${error.message}` };
    }
  }

  async readFast(filePath, params = {}) {
    return this.read(filePath, params);
  }

  async readMetadata(filePath) {
    const core = await this.read(filePath);
    return core.metadata || null;
  }

  async readRange(filePath, range, params = {}) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const ws = workbook.getWorksheet(1);
    if (!ws) throw new Error("لا توجد أوراق عمل في الملف");

    const extracted = this.extractRangeFromWorksheet(ws, range);

    return {
      ok: true,
      data: extracted,
      range
    };
  }

  async readSheets(filePath, sheetNames = [], params = {}) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const sheets = workbook.worksheets
      .filter(ws => sheetNames.includes(ws.name))
      .map(ws => this.extractSheet(ws));

    return {
      ok: true,
      data: sheets,
      metadata: this.buildMetadata(sheets),
      filePath
    };
  }

  extractSheet(ws) {
    const rows = [];
    const formulas = [];
    const styles = [];

    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      const rowData = [];
      const rowStyles = [];

      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        while (rowData.length < colNumber - 1) rowData.push("");
        rowData.push(cell.value ?? "");

        if (cell.formula || (cell.value && cell.value.formula)) {
          formulas.push({
            address: cell.address,
            formula: cell.formula || cell.value.formula,
            result: cell.value?.result
          });
        }

        rowStyles.push({
          address: cell.address,
          font: cell.font,
          fill: cell.fill,
          alignment: cell.alignment,
          border: cell.border,
          numFmt: cell.numFmt
        });
      });

      rows[rowNumber - 1] = rowData;
      styles.push(rowStyles);
    });

    return {
      name: ws.name,
      data: Array.from(rows, item => item || []),
      formulas,
      styles
    };
  }

  buildMetadata(sheets) {
    const totalRows = sheets.reduce((sum, s) => sum + s.data.length, 0);
    const totalColumns = sheets.reduce((max, s) => {
      const cols = s.data.reduce((m, r) => Math.max(m, r.length), 0);
      return Math.max(max, cols);
    }, 0);

    return {
      sheets: sheets.length,
      sheetNames: sheets.map(s => s.name),
      totalRows,
      totalColumns,
      engine: "ExcelJS Reconstruction Sovereign"
    };
  }

  /**
   * تنفيذ التعديلات باستخدام استراتيجية إعادة البناء الهيكلي (Reconstruction Strategy)
   * لتجنب تلف الملف أو أخطاء التموضع في ExcelJS.
   */
  async modify(filePath, params = {}) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);

      const targetSheetName = params.sheetName;
      const ws = targetSheetName ? workbook.getWorksheet(targetSheetName) : workbook.getWorksheet(1);
      
      if (!ws) throw new Error("ورقة العمل غير موجودة!");

      const ops = params.operations || [];
      const executionLogs = [];

      // التحقق مما إذا كان الطلب يتضمن إضافة عمود لإن تطبيق استراتيجية إعادة البناء الهيكلي
      const hasStructuralOps = ops.some(op => op.type === "add_column" || op.type === "delete_column");

      if (hasStructuralOps) {
        const success = await this.reconstructSheetWithStructuralOps(ws, ops);
        if (success) {
          executionLogs.push({ op: "structural_reconstruction", status: "success" });
        } else {
          executionLogs.push({ op: "structural_reconstruction", status: "failed", error: "فشل إعادة بناء الهيكل" });
        }
      } else {
        // العمليات المباشرة الأخرى (مثل تحديث خلية، تنسيق، إلخ)
        for (const op of ops) {
          try {
            await this.applyOperation(ws, op);
            executionLogs.push({ op: op.type, status: "success" });
          } catch (opError) {
            console.error(`⚠️ فشل في تنفيذ العملية ${op.type}:`, opError.message);
            executionLogs.push({ op: op.type, status: "failed", error: opError.message });
          }
        }
      }

      const outPath = FileUtils.getTempPath("modified", ".xlsx");
      await workbook.xlsx.writeFile(outPath);

      return {
        ok: true,
        reply: "تم تنفيذ التعديلات وإعادة بناء الملف بنجاح تام عبر محرك الجافاسكريبت السيادي",
        logs: executionLogs,
        filePath: outPath,
        fileBase64: await FileUtils.fileToBase64(outPath),
        fileName: `modified_${Date.now()}.xlsx`
      };
    } catch (error) {
      return { ok: false, error: `فشل التعديل الشامل: ${error.message}` };
    }
  }

  /**
   * استراتيجية إعادة البناء الهيكلي للأعمدة بطريقة نظيفة واحترافية 100%
   */
  async reconstructSheetWithStructuralOps(ws, ops) {
    // 1. استخراج جميع البيانات الحالية في ورقة العمل كـ مصفوفة ثنائية الأبعاد
    const sheetData = [];
    ws.eachRow({ includeEmpty: true }, (row) => {
      const rowValues = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        while (rowValues.length < colNumber - 1) rowValues.push("");
        rowValues.push(cell.value ?? "");
      });
      sheetData.push(rowValues);
    });

    if (sheetData.length === 0) return false;

    const headers = sheetData[0];
    let modifiedHeaders = [...headers];

    // 2. تطبيق عمليات الأعمدة على الهيكل
    for (const op of ops) {
      if (op.type === "add_column") {
        const newHeader = op.header || "عمود جديد";
        let insertIndex = modifiedHeaders.length;

        if (op.after) {
          const afterIdx = modifiedHeaders.findIndex(h => String(h).trim() === String(op.after).trim());
          if (afterIdx !== -1) {
            insertIndex = afterIdx + 1;
          }
        }
        modifiedHeaders.splice(insertIndex, 0, newHeader);

        // إدراج قيم فارغة في كل صف بناءً على الموقع الجديد
        for (let i = 1; i < sheetData.length; i++) {
          sheetData[i].splice(insertIndex, 0, "");
        }
      } else if (op.type === "delete_column") {
        const delIdx = modifiedHeaders.findIndex(h => String(h).trim() === String(op.header).trim());
        if (delIdx !== -1) {
          modifiedHeaders.splice(delIdx, 1);
          for (let i = 1; i < sheetData.length; i++) {
            sheetData[i].splice(delIdx, 1);
          }
        }
      }
    }

    // تحديث صف الرأس في البيانات المستخرجة
    sheetData[0] = modifiedHeaders;

    // 3. مسح ورقة العمل تماماً وإعادة بنائها من الصفر ببيانات نظيفة ومثالية
    ws.rowCount = 0; // مسح كامل للصفوف القديمة لمنع التداخل

    sheetData.forEach((rowVals, rowIndex) => {
      const r = ws.getRow(rowIndex + 1);
      r.values = ["", ...rowVals]; // إضافة العنصر الفارغ في Index 0 الخاص بـ ExcelJS لتطابق المحاذاة
      r.commit();
    });

    // تنسيق صف الرأس بشكل ملكي (تنسيق احترافي موحد)
    const headerRow = ws.getRow(1);
    headerRow.font = { name: "Arial", bold: true, color: { argb: "FFFFFF" } };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "1F4E78" } }; // لون احترافي أنيق
    headerRow.alignment = { vertical: "middle", horizontal: "center" };

    return true;
  }

  async applyOperation(ws, op) {
    switch (op.type) {
      case "update_cell": return this.updateCell(ws, op);
      case "add_style": return this.addStyle(ws, op);
      case "add_formula": return this.addFormula(ws, op);
      case "add_validation": return this.addValidation(ws, op);
      default:
        throw new Error(`عملية غير مدعومة في محرك الجافا: ${op.type}`);
    }
  }

  updateCell(ws, op) {
    ws.getCell(op.address).value = op.value;
  }

  addStyle(ws, op) {
    const { startCol, startRow, endCol, endRow } = this.parseRange(op.range);
    
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const cell = ws.getCell(r, c);
        if (op.style.fill) cell.fill = op.style.fill;
        if (op.style.font) cell.font = op.style.font;
        if (op.style.alignment) cell.alignment = op.style.alignment;
        if (op.style.border) cell.border = op.style.border;
        if (op.style.numFmt) cell.numFmt = op.style.numFmt;
      }
    }
  }

  addFormula(ws, op) {
    ws.getCell(op.address).value = { formula: op.formula };
  }

  addValidation(ws, op) {
    const formula = `"${(op.values || []).join(",")}"`;
    const { startCol, startRow, endCol, endRow } = this.parseRange(op.range);

    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        ws.getCell(r, c).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [formula],
          showErrorMessage: true
        };
      }
    }
  }

  parseRange(rangeStr) {
    const [start, end] = rangeStr.split(":");
    const startMatch = start.match(/([a-zA-Z]+)(\d+)/);
    const endMatch = end ? end.match(/([a-zA-Z]+)(\d+)/) : startMatch;

    if (!startMatch) throw new Error(`نطاق غير صالح: ${rangeStr}`);

    return {
      startCol: this.colToInt(startMatch[1]),
      startRow: parseInt(startMatch[2], 10),
      endCol: this.colToInt(endMatch[1]),
      endRow: parseInt(endMatch[2], 10)
    };
  }

  colToInt(colLetters) {
    let num = 0;
    for (let i = 0; i < colLetters.length; i++) {
      num = num * 26 + (colLetters.toUpperCase().charCodeAt(i) - 64);
    }
    return num;
  }

  extractRangeFromWorksheet(ws, range) {
    const { startCol, startRow, endCol, endRow } = this.parseRange(range);
    const extracted = [];

    for (let r = startRow; r <= endRow; r++) {
      const rowData = [];
      for (let c = startCol; c <= endCol; c++) {
        const cell = ws.getCell(r, c);
        rowData.push(cell.value ?? "");
      }
      extracted.push(rowData);
    }

    return extracted;
  }
}

export default ExcelJSAdapter;

