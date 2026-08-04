/**
 * excel/core/ExcelJSAdapter.js – Sovereign Unified ExcelJS Adapter
 * النسخة السيادية المتوافقة مع ExcelEngine الموحد
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
      case "add_row":
        return this.addRow(ws, op);
      case "update_cell":
        return this.updateCell(ws, op);
      case "color_cells":
        return this.colorCells(ws, op);
      case "format_range":
        return this.formatRange(ws, op);
      case "add_formula":
        return this.addFormula(ws, op);
      case "add_validation":
        return this.addValidation(ws, op);
      case "merge_cells":
        return ws.mergeCells(op.range);
      case "unmerge_cells":
        return ws.unMergeCells(op.range);
      case "add_comment":
        return this.addComment(ws, op);
      case "set_column_width":
        return ws.getColumn(op.column).width = op.width;
      case "set_row_height":
        return ws.getRow(op.row).height = op.height;
      case "add_filter":
        return this.addFilter(ws, op);
      default:
        console.warn(`⚠️ عملية غير معروفة: ${op.type}`);
    }
  }

  /* ============================================================
     🧩 عمليات الأعمدة والصفوف
     ============================================================ */

  addColumn(ws, op) {
    const headerRow = ws.getRow(1);
    const insertIndex = headerRow.cellCount + 1;

    ws.spliceColumns(insertIndex, 0, []);
    ws.getCell(1, insertIndex).value = op.header || "عمود جديد";
  }

  addRow(ws, op) {
    ws.addRow(op.data || []);
  }

  updateCell(ws, op) {
    const cell = ws.getCell(op.address);
    cell.value = op.value;
  }

  /* ============================================================
     🎨 تنسيق
     ============================================================ */

  colorCells(ws, op) {
    const { range, color } = op;
    const cells = ws.getCells(range);
    if (!cells) return;

    cells.forEach(cell => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: color || "FFFFFF00" }
      };
    });
  }

  formatRange(ws, op) {
    const { range, style } = op;
    const cells = ws.getCells(range);
    if (!cells) return;

    cells.forEach(cell => {
      if (style.fill) cell.fill = style.fill;
      if (style.font) cell.font = style.font;
      if (style.alignment) cell.alignment = style.alignment;
      if (style.border) cell.border = style.border;
      if (style.numFmt) cell.numFmt = style.numFmt;
    });
  }

  addFormula(ws, op) {
    ws.getCell(op.address).value = { formula: op.formula };
  }

  addValidation(ws, op) {
    const cell = ws.getCell(op.address);
    cell.dataValidation = {
      type: "list",
      formulae: op.formulae || ['"خيار1,خيار2,خيار3"'],
      showErrorMessage: true
    };
  }

  addComment(ws, op) {
    const cell = ws.getCell(op.address);
    cell.comment = {
      text: op.text || "تعليق",
      author: op.author || "Alatheer"
    };
  }

  addFilter(ws, op) {
    ws.autoFilter = {
      from: op.from || "A1",
      to: op.to || "Z100"
    };
  }
            }
