/**
 * api/tools/index.js – Sovereign Tools Dispatcher (Final Sovereign Edition)
 * موزّع سيادي موحّد لكل محركات الملفات – بدون أي بحث خارجي.
 */

import path from "path";

import { excelRead, excelModify, excelCreate } from "./excel.js";
import { pdfRead, pdfCreate } from "./pdf.js";
import { wordCreate } from "./word.js";
import { imageConvert } from "./image.js";
import { pptCreate } from "./ppt.js";

// 🔥 محرك LibreOffice
import libreConvert from "./external/engines/libre.js";

/* ============================================================
   🧠 الموزّع السيادي للقراءة
   ============================================================ */
export async function autoRead(filePath) {
  if (!filePath) return "⚠️ ما في مسار للملف.";

  const ext = path.extname(filePath).toLowerCase().replace(".", "");

  if (["xlsx", "xls", "csv"].includes(ext)) return await excelRead(filePath);
  if (ext === "pdf") return await pdfRead(filePath);

  if (["png", "jpg", "jpeg", "webp", "tiff", "avif"].includes(ext))
    return "📷 هذا ملف صورة – ما في استخراج نص منه حالياً.";

  return "⚠️ صيغة غير مدعومة.";
}

/* ============================================================
   🟥 البحث الخارجي متوقف بالكامل
   ============================================================ */
export async function autoSearch(query) {
  return "🔍 ميزة البحث الخارجي لسا ما اكتملت… عبد عم يشتغل عليها.";
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
  wordCreate,
  pptCreate,
  imageConvert,
  libreConvert
};
