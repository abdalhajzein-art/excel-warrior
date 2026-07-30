/**
 * api/tools/index.js – Sovereign Tools Dispatcher (Final Edition)
 * موزّع سيادي موحّد لكل محركات الملفات وأدوات البحث الحي
 */

import path from "path";

import { excelRead, excelModify, excelCreate } from "./excel.js";
import { pdfRead, pdfCreate } from "./pdf.js";
import { wordCreate } from "./word.js";
import { imageConvert } from "./image.js";
import { pptCreate } from "./ppt.js";

// 🔥 المسار الصحيح لمحرك LibreOffice
import libreConvert from "./external/engines/libre.js";

// 🌐 أداة بحث جوجل السيادية الحية (Google Search Grounding)
import { searchWithGoogle } from "./geminiSearch.js";

/* ============================================================
   🧠 الموزّع السيادي للقراءة
   ============================================================ */
export async function autoRead(filePath) {
  if (!filePath) return "⚠️ لا يوجد مسار للملف.";

  const ext = path.extname(filePath).toLowerCase().replace(".", "");

  if (["xlsx", "xls", "csv"].includes(ext)) return await excelRead(filePath);
  if (ext === "pdf") return await pdfRead(filePath);

  // ❌ Word/PPT قراءة غير مدعومة حالياً
  // if (["docx", "doc"].includes(ext)) return await wordRead(filePath);
  // if (["pptx", "ppt"].includes(ext)) return await pptRead(filePath);

  if (["png", "jpg", "jpeg", "webp", "tiff", "avif"].includes(ext))
    return "📷 صورة – لا يمكن استخراج نص منها.";

  return "⚠️ صيغة غير مدعومة.";
}

/* ============================================================
   🌐 موزع البحث السيادي الحي
   ============================================================ */
export async function autoSearch(query) {
  return await searchWithGoogle(query);
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
  libreConvert,
  searchWithGoogle,
  autoSearch
};
