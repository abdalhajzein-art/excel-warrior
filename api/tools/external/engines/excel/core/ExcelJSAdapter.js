/**
 * api/tools/external/engines/excel/core/ExcelJSAdapter.js 
 * Sovereign Advanced Excel Engine (Sovereign Edition - Alatheer AI Suite)
 * محرك ExcelJS سيادي متقدم، متوافق مع Kernel و Operations Schema، وواعٍ للجداول.
 * محصن ضد أخطاء النطاقات، ويدعم العمليات المتقدمة (الجداول، التنسيق الشرطي، الحماية).
 */

import ExcelJS from "exceljs";
import { FileUtils } from "../utils/FileUtils.js";
import { ExcelTableDetector } from "./ExcelTableDetector.js";

export class ExcelJSAdapter {
  constructor() {
    this.name = "exceljs";
  }

  async initialize() {
    return true;
  }

  /* ============================================================
     📖 القراءة – شاملة وآمنة
     ============================================================ */

  async read(filePath, params = {}) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);

      const sheets = workbook.worksheets.map(ws => this.extractSheet(ws));

      return {
        ok: true,
        reply: "تمت قراءة الملف بنجاح وبدقة عالية عبر ExcelJS",
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

  /* ============================================================
     🧩 كشف الجداول / الهيدر / الدمج
     ============================================================ */

  async detectTables(filePath, params = {}) {
    const core = await this.read(filePath, params);
    const firstSheet = core.data?.[0];
    if (!firstSheet) return null;

    const tableInfo = ExcelTableDetector.detectMainTable({
      data: firstSheet.data
    });

    return {
      sheetName: firstSheet.name,
      table: tableInfo
    };
  }

  async detectHeaders(filePath, params = {}) {
    const core = await this.read(filePath, params);
    const firstSheet = core.data?.[0];
    if (!firstSheet) return [];

    return firstSheet.data?.[0] || [];
  }

  async detectMergedRegions(filePath, params = {}) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const ws = workbook.getWorksheet(1);
    if (!ws) return [];
    return ws._merges ? Object.keys(ws._merges) : []; // Fix: _merges is an object in ExcelJS
  }

  /* ============================================================
     📖 استخراج ورقة واحدة – بأعلى كفاءة
     ============================================================ */

  extractSheet(ws) {
    const rows = [];
    const formulas = [];
    const styles = [];
    const comments = [];

    // استخدام actualRowCount لتجنب الدوران في مساحات فارغة ضخمة
    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      const rowData = [];
      const rowStyles = [];

      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        // تعبئة البيانات الفارغة للحفاظ على الترتيب الهيكلي
        while (rowData.length < colNumber - 1) rowData.push("");

        rowData.push(cell.value ?? "");

        if (cell.formula || (cell.value && cell.value.formula)) {
          formulas.push({
            address: cell.address,
            formula: cell.formula || cell.value.formula,
            result: cell.value?.result
          });
        }

        if (cell.note || cell.comment) { // ExcelJS uses note for comments sometimes
          comments.push({
            address: cell.address,
            text: cell.note || cell.comment?.text
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

    // تنظيف الصفوف الفارغة (الناتجة عن تخطي صفوف في eachRow)
    const cleanRows = Array.from(rows, item => item || []);

    return {
      name: ws.name,
      data: cleanRows,
      formulas,
      styles,
      comments
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
      hasFormulas: sheets.some(s => s.formulas.length > 0),
      hasComments: sheets.some(s => s.comments.length > 0),
      engine: "ExcelJS Sovereign"
    };
  }

  /* ============================================================
     ✏️ التعديل – محرك العمليات التراكمي
     ============================================================ */

  async modify(filePath, params = {}) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);

      const targetSheetName = params.sheetName;
      const ws = targetSheetName ? workbook.getWorksheet(targetSheetName) : workbook.getWorksheet(1);
      
      if (!ws) throw new Error("ورقة العمل غير موجودة!");

      const ops = params.operations || [];
      const executionLogs = [];

      for (const op of ops) {
        try {
          await this.applyOperation(ws, op);
          executionLogs.push({ op: op.type, status: "success" });
        } catch (opError) {
          console.error(`⚠️ فشل في تنفيذ العملية ${op.type}:`, opError.message);
          executionLogs.push({ op: op.type, status: "failed", error: opError.message });
          // لا نوقف المحرك، بل نتخطى العملية الفاسدة ونكمل (Agentic Resilience)
        }
      }

      const outPath = FileUtils.getTempPath("modified", ".xlsx");
      await workbook.xlsx.writeFile(outPath);

      return {
        ok: true,
        reply: "تم تنفيذ التعديلات بنجاح مع العزل الآمن للأخطاء",
        logs: executionLogs,
        filePath: outPath,
        fileBase64: await FileUtils.fileToBase64(outPath),
        fileName: `modified_${Date.now()}.xlsx`
      };
    } catch (error) {
      return { ok: false, error: `فشل التعديل الشامل: ${error.message}` };
    }
  }

  async applyOperation(ws, op) {
    switch (op.type) {
      case "add_column": return this.addColumn(ws, op);
      case "delete_column": return this.deleteColumn(ws, op);
      case "add_row": return this.addRow(ws, op);
      case "update_cell": return this.updateCell(ws, op);
      case "add_style": return this.addStyle(ws, op);
      case "add_formula": return this.addFormula(ws, op);
      case "add_validation": return this.addValidation(ws, op);
      case "format_table": return this.formatTable(ws, op);
      case "conditional_format": return this.addConditionalFormatting(ws, op);
      case "protect_sheet": return this.protectSheet(ws, op);
      case "pivot": return this.createPivot(ws, op);
      default:
        throw new Error(`عملية غير مدعومة في المحرك: ${op.type}`);
    }
  }

  /* ============================================================
     🧩 الأعمدة
     ============================================================ */

  addColumn(ws, op) {
    const headerRow = ws.getRow(1);
    // Values array is 1-indexed in ExcelJS. values[1] is column A.
    let insertIndex = headerRow.values ? headerRow.values.length : 1; 

    if (op.after) {
      const afterIndex = (headerRow.values || []).indexOf(op.after);
      if (afterIndex > 0) insertIndex = afterIndex + 1;
    }

    ws.spliceColumns(insertIndex, 0, []);
    ws.getCell(1, insertIndex).value = op.header || "عمود جديد";

    if (op.style) {
      ws.getCell(1, insertIndex).font = op.style.font || { bold: true };
      if (op.style.fill) ws.getCell(1, insertIndex).fill = op.style.fill;
    }

    if (op.validation && Array.isArray(op.validation)) {
      const formula = `"${op.validation.join(",")}"`;
      // نطبق على 1000 صف افتراضياً كحد أقصى لتجنب تضخم الملف
      for (let r = 2; r <= 1000; r++) {
        ws.getCell(r, insertIndex).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [formula],
          showErrorMessage: true,
          errorStyle: "error"
        };
      }
    }
  }

  deleteColumn(ws, op) {
    const headerRow = ws.getRow(1);
    const index = (headerRow.values || []).indexOf(op.header);
    if (index > 0) ws.spliceColumns(index, 1);
    else throw new Error(`لم يتم العثور على العمود: ${op.header}`);
  }

  /* ============================================================
     🧩 الصفوف
     ============================================================ */

  addRow(ws, op) {
    const headerRow = ws.getRow(1).values || [];
    const rowData = [];

    for (const key of Object.keys(op.data || {})) {
      const colIndex = headerRow.indexOf(key);
      if (colIndex > 0) rowData[colIndex] = op.data[key];
    }

    ws.addRow(rowData);
  }

  updateCell(ws, op) {
    ws.getCell(op.address).value = op.value;
  }

  /* ============================================================
     🎨 التنسيق والمجالات (Ranges)
     ============================================================ */

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

  /* ============================================================
     ➗ المعادلات والقيود
     ============================================================ */

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

  /* ============================================================
     📊 الجداول الرسمية (Native Tables)
     ============================================================ */

  formatTable(ws, op) {
    // دعم أصلي للجداول في ExcelJS
    const tableName = op.tableName || `Table_${Date.now()}`;
    const headerRow = ws.getRow(1).values || [];
    const columns = [];
    
    for (let i = 1; i < headerRow.length; i++) {
      columns.push({ name: headerRow[i] || `Col${i}`, filterButton: true });
    }

    if (columns.length === 0) throw new Error("لا توجد أعمدة لإنشاء الجدول");

    ws.addTable({
      name: tableName,
      ref: op.range || 'A1', // مثال: 'A1:D10'
      headerRow: true,
      totalsRow: op.totalsRow || false,
      style: {
        theme: op.theme || 'TableStyleMedium2', // ثيم إكسل الاحترافي
        showRowStripes: true,
      },
      columns: columns,
      rows: [] // البيانات موجودة أصلاً في الشيت، نحدد الإطار فقط
    });
  }

  /* ============================================================
     ✨ تنسيق شرطي وحماية (ميزات سيادية جديدة)
     ============================================================ */

  addConditionalFormatting(ws, op) {
    ws.addConditionalFormatting({
      ref: op.range,
      rules: [
        {
          type: op.ruleType || 'cellIs', // 'expression', 'cellIs', 'top10'
          operator: op.operator || 'greaterThan',
          formulae: op.formulae || [],
          style: op.style
        }
      ]
    });
  }

  async protectSheet(ws, op) {
    const password = op.password || 'AlatheerSecured';
    await ws.protect(password, {
      selectLockedCells: true,
      selectUnlockedCells: true,
      formatCells: false,
      insertRows: false
    });
  }

  /* ============================================================
     📈 Pivot (القيود)
     ============================================================ */

  createPivot(ws, op) {
    console.warn("⚠️ Pivot غير مدعوم بالكامل في ExcelJS. يتم تجهيز البيانات للتحليل لاحقاً.");
    const sheetName = op.targetSheet || "Pivot_Summary";
    let sheet = ws.workbook.getWorksheet(sheetName);
    if (!sheet) sheet = ws.workbook.addWorksheet(sheetName);
    sheet.getCell("A1").value = "تم طلب Pivot. ExcelJS لا يولد محرك Pivot أصلي. استخدم Pandas للتحليل.";
  }

  /* ============================================================
     🛠️ أدوات مساعدة متقدمة للمحرك (Engine Helpers)
     ============================================================ */

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

