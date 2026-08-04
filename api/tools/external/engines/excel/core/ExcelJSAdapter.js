/**
 * excel/core/ExcelJSAdapter.js – Sovereign Advanced Excel Engine
 * النسخة السيادية المتقدمة المتوافقة مع Kernel و Operations Schema
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
     📖 القراءة
     ============================================================ */

  async read(filePath, params = {}) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const sheets = workbook.worksheets.map(ws => this.extractSheet(ws));

    return {
      ok: true,
      reply: "تمت قراءة الملف بنجاح",
      data: sheets,
      metadata: this.buildMetadata(sheets),
      filePath
    };
  }

  extractSheet(ws) {
    const rows = [];
    const formulas = [];
    const styles = [];
    const comments = [];

    ws.eachRow((row) => {
      const rowData = [];
      const rowStyles = [];

      row.eachCell((cell) => {
        rowData.push(cell.value || "");

        if (cell.formula) {
          formulas.push({
            address: cell.address,
            formula: cell.formula,
            value: cell.value
          });
        }

        if (cell.comment) {
          comments.push({
            address: cell.address,
            text: cell.comment.text,
            author: cell.comment.author
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

      rows.push(rowData);
      styles.push(rowStyles);
    });

    return {
      name: ws.name,
      data: rows,
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
      totalRows,
      totalColumns,
      hasFormulas: sheets.some(s => s.formulas.length > 0),
      hasComments: sheets.some(s => s.comments.length > 0),
      engines: ["exceljs"]
    };
  }

  /* ============================================================
     ✏️ التعديل
     ============================================================ */

  async modify(filePath, params = {}) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const ws = workbook.getWorksheet(1);
    if (!ws) throw new Error("لا توجد أوراق عمل في الملف");

    const ops = params.operations || [];
    for (const op of ops) {
      await this.applyOperation(ws, op);
    }

    const outPath = FileUtils.getTempPath("modified");
    await workbook.xlsx.writeFile(outPath);

    return {
      ok: true,
      reply: "تم تنفيذ التعديلات بنجاح",
      filePath: outPath,
      fileBase64: await FileUtils.fileToBase64(outPath),
      fileName: "modified.xlsx"
    };
  }

  async applyOperation(ws, op) {
    switch (op.type) {
      case "add_column":
        return this.addColumn(ws, op);

      case "delete_column":
        return this.deleteColumn(ws, op);

      case "add_row":
        return this.addRow(ws, op);

      case "update_cell":
        return this.updateCell(ws, op);

      case "add_style":
        return this.addStyle(ws, op);

      case "add_formula":
        return this.addFormula(ws, op);

      case "add_validation":
        return this.addValidation(ws, op);

      case "format_table":
        return this.formatTable(ws, op);

      case "pivot":
        return this.createPivot(ws, op);

      default:
        console.warn(`⚠️ عملية غير معروفة: ${op.type}`);
    }
  }

  /* ============================================================
     🧩 عمليات الأعمدة
     ============================================================ */

  addColumn(ws, op) {
    const headerRow = ws.getRow(1);

    let insertIndex = headerRow.cellCount + 1;

    if (op.after) {
      const afterIndex = headerRow.values.indexOf(op.after);
      if (afterIndex > -1) insertIndex = afterIndex + 1;
    }

    ws.spliceColumns(insertIndex, 0, []);
    ws.getCell(1, insertIndex).value = op.header || "عمود جديد";

    if (op.style) {
      ws.getCell(1, insertIndex).font = { bold: true };
      ws.getCell(1, insertIndex).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFD700" }
      };
    }

    if (op.validation && Array.isArray(op.validation)) {
      const formula = `"${op.validation.join(",")}"`;
      ws.getColumn(insertIndex).eachCell((cell, rowNumber) => {
        if (rowNumber === 1) return;
        cell.dataValidation = {
          type: "list",
          formulae: [formula],
          showErrorMessage: true
        };
      });
    }
  }

  deleteColumn(ws, op) {
    const headerRow = ws.getRow(1);
    const index = headerRow.values.indexOf(op.header);
    if (index > -1) ws.spliceColumns(index, 1);
  }

  /* ============================================================
     🧩 الصفوف
     ============================================================ */

  addRow(ws, op) {
    const headerRow = ws.getRow(1).values;
    const rowData = [];

    for (const key of Object.keys(op.data)) {
      const colIndex = headerRow.indexOf(key);
      if (colIndex > -1) rowData[colIndex - 1] = op.data[key];
    }

    ws.addRow(rowData);
  }

  updateCell(ws, op) {
    ws.getCell(op.address).value = op.value;
  }

  /* ============================================================
     🎨 تنسيق
     ============================================================ */

  addStyle(ws, op) {
    const cells = ws.getCells(op.range);
    if (!cells) return;

    cells.forEach(cell => {
      if (op.style.fill) cell.fill = op.style.fill;
      if (op.style.font) cell.font = op.style.font;
      if (op.style.alignment) cell.alignment = op.style.alignment;
      if (op.style.border) cell.border = op.style.border;
      if (op.style.numFmt) cell.numFmt = op.style.numFmt;
    });
  }

  /* ============================================================
     ➗ صيغ
     ============================================================ */

  addFormula(ws, op) {
    ws.getCell(op.address).value = { formula: op.formula };
  }

  /* ============================================================
     ✔️ قوائم منسدلة
     ============================================================ */

  addValidation(ws, op) {
    const formula = `"${op.values.join(",")}"`;
    const range = ws.getCells(op.range);

    range.forEach(cell => {
      cell.dataValidation = {
        type: "list",
        formulae: [formula],
        showErrorMessage: true
      };
    });
  }

  /* ============================================================
     📊 تنسيق الجداول
     ============================================================ */

  formatTable(ws, op) {
    ws.autoFilter = { from: op.range.split(":")[0], to: op.range.split(":")[1] };
  }

  /* ============================================================
     📈 Pivot
     ============================================================ */

  createPivot(ws, op) {
    console.warn("⚠️ Pivot غير مدعوم بالكامل في ExcelJS، سيتم تنفيذ نسخة مبسطة.");
    const sheet = ws.workbook.addWorksheet(op.targetSheet || "PivotSheet");
    sheet.getCell("A1").value = "Pivot غير مدعوم بالكامل في ExcelJS";
  }
}
