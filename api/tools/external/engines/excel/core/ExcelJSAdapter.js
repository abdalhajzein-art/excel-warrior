/**
 * api/tools/external/engines/excel/core/ExcelJSAdapter.js 
 * Sovereign Advanced Excel Engine (Sovereign Edition - Alatheer AI Suite)
 * محرك ExcelJS سيادي متقدم، يعتمد 100% على JavaScript دون أي اعتماد على Python.
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
      engine: "ExcelJS Pure JavaScript Sovereign"
    };
  }

  async modify(filePath, params = {}) {
    try {
      const workbook = new ExcelJS.Workbook();
      // قراءة الملف مع الحفاظ على البيانات المتقدمة قدر الإمكان
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
        }
      }

      const outPath = FileUtils.getTempPath("modified", ".xlsx");
      await workbook.xlsx.writeFile(outPath);

      return {
        ok: true,
        reply: "تم تنفيذ التعديلات بنجاح عبر محرك الجافاسكريبت السيادي",
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
      default:
        throw new Error(`عملية غير مدعومة في محرك الجافا: ${op.type}`);
    }
  }

  addColumn(ws, op) {
    const headerRow = ws.getRow(1);
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
  }

  deleteColumn(ws, op) {
    const headerRow = ws.getRow(1);
    const index = (headerRow.values || []).indexOf(op.header);
    if (index > 0) ws.spliceColumns(index, 1);
    else throw new Error(`لم يتم العثور على العمود: ${op.header}`);
  }

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

  formatTable(ws, op) {
    const tableName = op.tableName || `Table_${Date.now()}`;
    const headerRow = ws.getRow(1).values || [];
    const columns = [];
    
    for (let i = 1; i < headerRow.length; i++) {
      columns.push({ name: headerRow[i] || `Col${i}`, filterButton: true });
    }

    if (columns.length === 0) return;

    ws.addTable({
      name: tableName,
      ref: op.range || 'A1',
      headerRow: true,
      totalsRow: op.totalsRow || false,
      style: {
        theme: op.theme || 'TableStyleMedium2',
        showRowStripes: true,
      },
      columns: columns,
      rows: []
    });
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

