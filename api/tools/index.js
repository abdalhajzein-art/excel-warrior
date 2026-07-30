/**
 * api/tools/index.js – Sovereign Tools Dispatcher (Final Edition)
 * موزّع سيادي موحّد لكل محركات الملفات بدون أي ذكاء لغوي
 */

import path from "path";

import { excelRead, excelModify, excelCreate } from "./excel.js";
import { pdfRead, pdfCreate } from "./pdf.js";
import { wordRead, wordCreate } from "./word.js";
import { imageConvert } from "./image.js";
import { pptRead, pptCreate } from "./ppt.js";
import { libreConvert } from "./libre.js";

/* ============================================================
   🧠 الموزّع السيادي للقراءة
   ============================================================ */
export async function autoRead(filePath) {
  if (!filePath) return "⚠️ لا يوجد مسار للملف.";

  const ext = path.extname(filePath).toLowerCase().replace(".", "");

  // Excel
  if (["xlsx", "xls", "csv"].includes(ext)) {
    return await excelRead(filePath);
  }

  // PDF
  if (ext === "pdf") {
    return await pdfRead(filePath);
  }

  // Word
  if (["docx", "doc"].includes(ext)) {
    return await wordRead(filePath);
  }

  // PowerPoint
  if (["pptx", "ppt"].includes(ext)) {
    return await pptRead(filePath);
  }

  // Images
  if (["png", "jpg", "jpeg", "webp", "tiff", "avif"].includes(ext)) {
    return "📷 صورة – لا يمكن استخراج نص منها.";
  }

  return "⚠️ صيغة غير مدعومة.";
}

/* ============================================================
   🟦 التصدير السيادي الموحد
   ============================================================ */
export {
  excelRead,
  excelModify,
  excelCreate,
  pdfRead,
  pdfCreate,
  wordRead,
  wordCreate,
  pptRead,
  pptCreate,
  imageConvert,
  libreConvert
};