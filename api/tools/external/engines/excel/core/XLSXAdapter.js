/**
 * excel/core/XLSXAdapter.js – Sovereign Legacy XLSX Adapter
 * محرك بسيط لقراءة ملفات XLS/XLSX القديمة فقط.
 * بدون تعديل – بدون تنسيق – بدون صيغ – بدون جداول.
 */

import XLSX from "xlsx";
import { FileUtils } from "../utils/FileUtils.js";

export class XLSXAdapter {
  constructor() {
    this.name = "xlsx";
  }

  async initialize() {
    return true;
  }

  /* ============================================================
     📖 القراءة (القدرات الأساسية فقط)
     ============================================================ */

  async read(filePath, params = {}) {
    const workbook = XLSX.readFile(filePath);

    const sheets = workbook.SheetNames.map((sheetName) => {
      const ws = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

      return {
        name: sheetName,
        data,
        formulas: [],
        styles: [],
        comments: []
      };
    });

    return {
      ok: true,
      reply: "تمت قراءة الملف بنجاح عبر محرك XLSX (النسخة القديمة)",
      data: sheets,
      metadata: this.buildMetadata(sheets),
      filePath
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
      hasFormulas: false,
      hasComments: false,
      engines: ["xlsx"]
    };
  }

  /* ============================================================
     ✏️ التعديل (غير مدعوم)
     ============================================================ */

  async modify() {
    throw new Error("❌ XLSXAdapter لا يدعم التعديل. استخدم ExcelJSAdapter.");
  }

  async applyOperations() {
    throw new Error("❌ XLSXAdapter لا يدعم العمليات المتقدمة.");
  }

  /* ============================================================
     🏗 إنشاء وتحويل (غير مدعوم)
     ============================================================ */

  async create() {
    throw new Error("❌ XLSXAdapter لا يدعم إنشاء ملفات جديدة.");
  }

  async convertToPdf() {
    throw new Error("❌ XLSXAdapter لا يدعم التحويل إلى PDF.");
  }

  async convertToCsv() {
    throw new Error("❌ XLSXAdapter لا يدعم التحويل إلى CSV.");
  }
}
