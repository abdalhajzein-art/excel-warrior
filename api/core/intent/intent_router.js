/**
 * api/core/intent/intent_file.js
 * Sovereign File Intent – نوايا الملفات + الصور
 * بدون أي بحث خارجي أو ذكاء زائد
 */

export default function detectFileIntent(text = "") {
  if (!text || typeof text !== "string") return "chat_mode";

  const lower = text.toLowerCase().trim();

  /* ============================================================
     🟩 1) نوايا PDF
     ============================================================ */
  if (lower.endsWith(".pdf") || lower.includes("pdf")) {
    if (lower.includes("اقرأ") || lower.includes("قراءة") || lower.includes("read")) {
      return "pdf_read";
    }
    if (lower.includes("حول") || lower.includes("convert") || lower.includes("تحويل")) {
      return "pdf_convert";
    }
    if (lower.includes("لخص") || lower.includes("ملخص") || lower.includes("summary")) {
      return "pdf_summary";
    }
    return "pdf_file";
  }

  /* ============================================================
     🟩 2) نوايا Word (docx)
     ============================================================ */
  if (lower.endsWith(".docx") || lower.includes("docx") || lower.includes("word")) {
    if (lower.includes("حول") || lower.includes("convert") || lower.includes("تحويل")) {
      return "word_convert";
    }
    if (lower.includes("لخص") || lower.includes("ملخص") || lower.includes("summary")) {
      return "word_summary";
    }
    return "word_file";
  }

  /* ============================================================
     🟩 3) نوايا Excel (xlsx / xls)
     ============================================================ */
  if (
    lower.endsWith(".xlsx") ||
    lower.endsWith(".xls") ||
    lower.includes("excel") ||
    lower.includes("جدول")
  ) {
    if (lower.includes("اقرأ") || lower.includes("قراءة") || lower.includes("read")) {
      return "excel_read";
    }
    if (lower.includes("عدل") || lower.includes("تعديل") || lower.includes("modify")) {
      return "excel_modify";
    }
    if (lower.includes("لخص") || lower.includes("summary")) {
      return "excel_summary";
    }
    return "excel_file";
  }

  /* ============================================================
     🟩 4) نوايا الصور (png / jpg / jpeg / webp / tiff / avif)
     ============================================================ */
  const imageExt = /\.(png|jpg|jpeg|webp|tiff|avif)$/;

  if (imageExt.test(lower)) {
    if (lower.includes("حول") || lower.includes("convert") || lower.includes("تحويل")) {
      return "image_convert";
    }
    if (lower.includes("ضغط") || lower.includes("compress")) {
      return "image_compress";
    }
    if (lower.includes("base64")) {
      return "image_base64";
    }
    return "image_file";
  }

  /* ============================================================
     🟦 5) إذا ما في أي نية ملف → دردشة
     ============================================================ */
  return "chat_mode";
        }
