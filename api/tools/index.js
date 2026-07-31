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

// 🌐 محرك بحث جوجل الحقيقي عبر DuckDuckGo Proxy (!g)
import { googleReal } from "./googleReal.js";

/* ============================================================
   🧠 الموزّع السيادي للقراءة
   ============================================================ */
export async function autoRead(filePath) {
  if (!filePath) return "⚠️ لا يوجد مسار للملف.";

  const ext = path.extname(filePath).toLowerCase().replace(".", "");

  if (["xlsx", "xls", "csv"].includes(ext)) return await excelRead(filePath);
  if (ext === "pdf") return await pdfRead(filePath);

  if (["png", "jpg", "jpeg", "webp", "tiff", "avif"].includes(ext))
    return "📷 صورة – لا يمكن استخراج نص منها.";

  return "⚠️ صيغة غير مدعومة.";
}

/* ============================================================
   🌐 موزع البحث السيادي الحي
   ============================================================ */
export async function autoSearch(query) {
  return await googleReal(query);
}

/* ============================================================
   🟦 التصدير السيادي الموحد (بدون تكرار)
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
  googleReal
};
