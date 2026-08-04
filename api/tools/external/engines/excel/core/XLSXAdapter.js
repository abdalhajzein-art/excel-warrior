/**
 * excel/core/XLSXAdapter.js – Sovereign SheetJS Adapter (Advanced Edition)
 * طبقة قراءة سيادية عامة تعتمد على SheetJS بكامل قدراتها.
 * بدون تعديل – قراءة فقط – ترجع بيانات غنية جداً.
 */

import XLSX from "xlsx";
import { FileUtils } from "../utils/FileUtils.js";

export class XLSXAdapter {
  constructor() {
    this.name = "sheetjs";
  }

  async initialize() {
    return true;
  }

  /* ============================================================
     📖 القراءة السيادية – SheetJS بكامل قوتها
     ============================================================ */

  async read(filePath, params = {}) {
    const workbook = XLSX.readFile(filePath, {
      cellStyles: true,
      cellDates: true,
      cellNF: true,
      sheetStubs: true
    });

    const sheets = workbook.SheetNames.map((sheetName) => {
      const ws = workbook.Sheets[sheetName];

      const data = XLSX.utils.sheet_to_json(ws, {
        header: 1,
        raw: true,
        defval: ""
      });

      const merges = ws["!merges"] || [];
      const colInfo = ws["!cols"] || [];
      const rowInfo = ws["!rows"] || [];
      const sheetProps = ws["!sheetProps"] || {};
      const hyperlinks = ws["!links"] || [];
      const comments = ws["!comments"] || [];

      const formulas = [];
      Object.keys(ws).forEach((cellAddr) => {
        const cell = ws[cellAddr];
        if (cell && cell.f) {
          formulas.push({
            address: cellAddr,
            formula: cell.f,
            value: cell.v
          });
        }
      });

      return {
        name: sheetName,
        data,
        merges,
        formulas,
        comments,
        hyperlinks,
        colInfo,
        rowInfo,
        sheetProps
      };
    });

    return {
      ok: true,
      reply: "تمت قراءة الملف بنجاح عبر SheetJS (النسخة السيادية)",
      data: sheets,
      metadata: this.buildMetadata(sheets),
      workbookProps: workbook.Props || {},
      workbookCustProps: workbook.Custprops || {},
      workbookWorkbook: workbook.Workbook || {},
      filePath
    };
  }

  /* ============================================================
     📊 ميتاداتا عامة لأي ملف
     ============================================================ */

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
      hasMerges: sheets.some(s => s.merges.length > 0),
      engines: ["sheetjs"]
    };
  }

  /* ============================================================
     ✏️ التعديل غير مدعوم
     ============================================================ */

  async modify() {
    throw new Error("❌ XLSXAdapter (SheetJS) لا يدعم التعديل. استخدم ExcelJSAdapter.");
  }
}

export default XLSXAdapter;
