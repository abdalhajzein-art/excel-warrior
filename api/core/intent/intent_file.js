/**
 * api/core/intent/intent_file.js
 * Sovereign File Intent – نوايا الملفات + الصور
 */

export default function detectFileIntent(text = "") {
  if (!text || typeof text !== "string") return "chat_mode";

  const lower = text.toLowerCase().trim();

  /* ============================================================
     🟩 PDF
     ============================================================ */
  if (lower.endsWith(".pdf") || lower.includes("pdf")) {
    return "pdf_file";
  }

  /* ============================================================
     🟩 Word (docx)
     ============================================================ */
  if (lower.endsWith(".docx") || lower.includes("docx") || lower.includes("word")) {
    return "docx_file";
  }

  /* ============================================================
     🟩 Excel (xlsx / xls)
     ============================================================ */
  if (
    lower.endsWith(".xlsx") ||
    lower.endsWith(".xls") ||
    lower.includes("excel") ||
    lower.includes("جدول")
  ) {
    return "excel_file";
  }

  /* ============================================================
     🟩 Images
     ============================================================ */
  const imageExt = /\.(png|jpg|jpeg|webp|tiff|avif)$/;
  if (imageExt.test(lower)) {
    return "image_file";
  }

  /* ============================================================
     🟦 لا يوجد ملف → دردشة
     ============================================================ */
  return "chat_mode";
}
