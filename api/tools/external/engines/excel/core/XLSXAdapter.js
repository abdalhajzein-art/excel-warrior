/**
 * api/tools/external/engines/excel/core/XLSXAdapter.js
 * Sovereign SheetJS Adapter (Advanced Edition - Alatheer AI Suite)
 * محرك قراءة جبار، محصن ضد الأخطاء، ينظف البيانات، ويدعم الملفات الضخمة.
 * القراءة فقط (Read-Only) - المصدر الأكثر أماناً لاستخراج الهيكلية والبيانات.
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
     📖 القراءة السيادية – قوية وآمنة (Buffer & Path)
     ============================================================ */

  async read(filePathOrBuffer, params = {}) {
    try {
      let workbook;
      const options = {
        cellStyles: true,
        cellDates: true,
        cellNF: true,
        sheetStubs: true,
        type: typeof filePathOrBuffer === "string" ? "file" : "buffer"
      };

      if (options.type === "file") {
        workbook = XLSX.readFile(filePathOrBuffer, options);
      } else {
        workbook = XLSX.read(filePathOrBuffer, options);
      }

      const sheets = workbook.SheetNames.map((sheetName) => {
        const ws = workbook.Sheets[sheetName];

        // استخراج البيانات مع التنظيف
        const rawData = XLSX.utils.sheet_to_json(ws, {
          header: 1,
          raw: true,
          defval: "" // يمنع قيم undefined
        });

        // تنظيف الصفوف الفارغة بالكامل من نهاية الشيت
        const data = this.cleanTrailingEmptyRows(rawData);

        const merges = ws["!merges"] || [];
        const colInfo = ws["!cols"] || [];
        const rowInfo = ws["!rows"] || [];
        const sheetProps = ws["!sheetProps"] || {};
        const hyperlinks = ws["!links"] || [];
        const comments = ws["!comments"] || [];

        const formulas = [];
        Object.keys(ws).forEach((cellAddr) => {
          // تجنب الخصائص الداخلية لـ SheetJS مثل !ref
          if (cellAddr.startsWith("!")) return;
          
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
        reply: "تمت قراءة الملف وتحليل هيكله بنجاح عبر المحرك السيادي (SheetJS)",
        data: sheets,
        metadata: this.buildMetadata(sheets),
        workbookProps: workbook.Props || {},
        filePath: typeof filePathOrBuffer === "string" ? filePathOrBuffer : "Buffer Data"
      };
    } catch (error) {
      console.error(`❌ [XLSXAdapter Error]: ${error.message}`);
      return { ok: false, error: `فشل المحرك في قراءة الملف: ${error.message}` };
    }
  }

  /* ============================================================
     🧹 تنظيف البيانات العمياء (Ghost Rows)
     ============================================================ */
  cleanTrailingEmptyRows(data) {
    let lastNonEmptyRow = -1;
    for (let i = data.length - 1; i >= 0; i--) {
      if (data[i].some(cell => String(cell).trim() !== "")) {
        lastNonEmptyRow = i;
        break;
      }
    }
    return lastNonEmptyRow === -1 ? [] : data.slice(0, lastNonEmptyRow + 1);
  }

  /* ============================================================
     📊 بناء الميتاداتا
     ============================================================ */
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
      hasMerges: sheets.some(s => s.merges.length > 0),
      engine: "SheetJS Sovereign"
    };
  }

  async modify() {
    throw new Error("❌ محرك SheetJS مخصص للقراءة السريعة فقط ولا يدعم التعديل في معمارية الأثير. تم توجيه المهمة إلى ExcelJS.");
  }
}

export default XLSXAdapter;

