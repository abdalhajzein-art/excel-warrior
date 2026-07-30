/**
 * api/tools/helpers.js
 * أدوات النظام المساعدة للمسارات الآمنة ومعالجة قيم الخلايا
 */

import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

export const execAsync = promisify(exec);

/**
 * مولد مسارات مؤقتة بأسماء ASCII آمنة 100% للتفاعل مع LibreOffice و CLI
 */
export function safeTempFile(ext = "tmp") {
  const cleanExt = ext.replace(/^\./, "") || "tmp";
  const safeName = `sovereign_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${cleanExt}`;
  return path.join("/tmp", safeName);
}

/**
 * دالة مساعدة لحذف الملفات المؤقتة بأمان دون إيقاف السيرفر
 */
export function safeUnlink(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (e) {
      console.warn(`⚠️ تعذر حذف الملف المؤقت: ${filePath}`, e.message);
    }
  }
}

/**
 * مستخرج قيم الخلايا الذكي (فك المعادلات، النصوص الغنية، التواريخ، والروابط)
 */
export function extractCellValue(cellValue) {
  if (cellValue === null || cellValue === undefined) return "";

  if (typeof cellValue === "object") {
    if (cellValue.result !== undefined && cellValue.result !== null) {
      if (typeof cellValue.result === "object") {
        if (cellValue.result.error) return "";
        if (cellValue.result instanceof Date) return cellValue.result.toISOString().split("T")[0];
      }
      return cellValue.result.toString().trim();
    }
    if (cellValue.richText && Array.isArray(cellValue.richText)) {
      return cellValue.richText.map((r) => r.text || "").join("").trim();
    }
    if (cellValue instanceof Date) {
      return cellValue.toISOString().split("T")[0];
    }
    if (cellValue.text) {
      return extractCellValue(cellValue.text);
    }
    return "";
  }

  return cellValue.toString().trim();
}
