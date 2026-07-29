/**
 * api/upload.js – Sovereign Lite File Loader
 * نسخة خفيفة بدون أي تحليل أو Metadata
 */

import fs from "fs";
import path from "path";
import os from "os";

export default async function parseExcelUpload(filePath) {
  try {
    // قراءة الملف كـ Buffer
    const buffer = fs.readFileSync(filePath);

    // تحويله إلى Base64
    const fileBase64 = buffer.toString("base64");

    // استخراج اسم الملف
    const fileName = path.basename(filePath);

    // إرجاع بيانات بسيطة فقط
    return {
      fileName,
      fileBase64,
      path: filePath
    };

  } catch (err) {
    console.error("❌ خطأ في parseExcelUpload:", err);
    return {
      fileName: null,
      fileBase64: null,
      path: null,
      error: err.message
    };
  }
}