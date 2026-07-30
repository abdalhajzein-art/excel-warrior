/**
 * engines/image.js – Sovereign Unified Image Engine (Heavy Edition)
 * نسخة موحّدة بالكامل مع باقي المحركات
 */

import fs from "fs";
import path from "path";
import sharp from "sharp";
import { execSync } from "child_process";

export default async function imageEngine(filePath, action, params = {}) {
  try {
    switch (action) {
      case "read":
        return await readImage(filePath);

      case "extract":
        return await extractImage(filePath);

      case "convert":
        return await convertImage(filePath, params);

      case "modify":
        return await modifyImage(filePath, params);

      case "analyze":
        return await analyzeImage(filePath);

      default:
        return normalizedError("عملية غير معروفة.");
    }
  } catch (err) {
    return normalizedError("خطأ أثناء معالجة الصورة.", err);
  }
}

/* ============================================================
   🟩 READ – قراءة الصورة
   ============================================================ */
async function readImage(filePath) {
  try {
    const metadata = await sharp(filePath).metadata();

    return normalizedReply("تم قراءة الصورة بنجاح.", {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      size: metadata.size
    });
  } catch (err) {
    return normalizedError("فشل قراءة الصورة.", err);
  }
}

/* ============================================================
   🟦 EXTRACT – استخراج نص من الصورة (OCR)
   ============================================================ */
async function extractImage(filePath) {
  try {
    const out = path.join(path.dirname(filePath), `ocr_${Date.now()}.txt`);

    execSync(`tesseract "${filePath}" "${out.replace(".txt", "")}"`);

    const text = fs.readFileSync(out, "utf8");

    return normalizedReply("تم استخراج النص من الصورة باستخدام OCR.", {
      text
    });
  } catch (err) {
    return normalizedError("فشل استخراج النص من الصورة.", err);
  }
}

/* ============================================================
   🟥 CONVERT – تحويل الصورة
   ============================================================ */
async function convertImage(filePath, params) {
  try {
    const format = params.format || "png";
    const out = path.join(path.dirname(filePath), `converted_${Date.now()}.${format}`);

    await sharp(filePath).toFormat(format).toFile(out);

    const base64 = fs.readFileSync(out).toString("base64");

    return normalizedFile(`تم تحويل الصورة إلى ${format}.`, out, `converted.${format}`, base64);
  } catch (err) {
    return normalizedError("فشل تحويل الصورة.", err);
  }
}

/* ============================================================
   🟧 MODIFY – تعديل الصورة
   ============================================================ */
async function modifyImage(filePath, params) {
  try {
    const width = params.width || 800;
    const height = params.height || null;

    const out = path.join(path.dirname(filePath), `modified_${Date.now()}.png`);

    await sharp(filePath).resize(width, height).toFile(out);

    const base64 = fs.readFileSync(out).toString("base64");

    return normalizedFile("تم تعديل الصورة (تغيير الحجم).", out, "modified.png", base64);
  } catch (err) {
    return normalizedError("فشل تعديل الصورة.", err);
  }
}

/* ============================================================
   🟪 ANALYZE – تحليل الصورة
   ============================================================ */
async function analyzeImage(filePath) {
  try {
    const metadata = await sharp(filePath).metadata();

    return normalizedReply("تحليل الصورة مكتمل.", {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      hasAlpha: metadata.hasAlpha || false
    });
  } catch (err) {
    return normalizedError("فشل تحليل الصورة.", err);
  }
}

/* ============================================================
   🟫 طبقة توحيد الردود
   ============================================================ */
function normalizedReply(reply, data = {}) {
  return {
    ok: true,
    reply,
    data,
    fileBase64: null,
    fileName: null,
    filePath: null
  };
}

function normalizedFile(reply, filePath, fileName, base64) {
  return {
    ok: true,
    reply,
    data: null,
    fileBase64: base64,
    fileName,
    filePath
  };
}

function normalizedError(reply, err = null) {
  return {
    ok: false,
    reply,
    error: err ? err.message : reply,
    data: null,
    fileBase64: null,
    fileName: null,
    filePath: null
  };
}