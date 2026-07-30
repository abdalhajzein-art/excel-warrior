/**
 * engines/docx.js – Sovereign Unified DOCX Engine (Heavy Edition)
 * نسخة موحّدة بالكامل مع باقي المحركات
 */

import fs from "fs";
import path from "path";
import mammoth from "mammoth";
import { execSync } from "child_process";

export default async function docxEngine(filePath, action, params = {}) {
  try {
    switch (action) {
      case "read":
        return await readDOCX(filePath);

      case "extract":
        return await extractDOCX(filePath);

      case "convert":
        return await convertDOCX(filePath, params);

      case "modify":
        return await modifyDOCX(filePath, params);

      case "analyze":
        return await analyzeDOCX(filePath);

      default:
        return normalizedError("عملية غير معروفة.");
    }
  } catch (err) {
    return normalizedError("خطأ أثناء معالجة DOCX.", err);
  }
}

/* ============================================================
   🟩 READ – قراءة DOCX
   ============================================================ */
async function readDOCX(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    const result = await mammoth.extractRawText({ buffer });

    return normalizedReply("تم قراءة ملف Word بنجاح.", {
      text: result.value,
      length: result.value.length
    });
  } catch (err) {
    return normalizedError("فشل قراءة DOCX.", err);
  }
}

/* ============================================================
   🟦 EXTRACT – استخراج محتوى DOCX
   ============================================================ */
async function extractDOCX(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    const result = await mammoth.convertToHtml({ buffer });

    return normalizedReply("تم استخراج محتوى Word كـ HTML.", {
      html: result.value
    });
  } catch (err) {
    return normalizedError("فشل استخراج محتوى DOCX.", err);
  }
}

/* ============================================================
   🟥 CONVERT – تحويل DOCX
   ============================================================ */
async function convertDOCX(filePath) {
  try {
    const out = path.join(path.dirname(filePath), `converted_${Date.now()}.pdf`);

    execSync(`libreoffice --headless --convert-to pdf "${filePath}" --outdir "${path.dirname(out)}"`);

    const base64 = fs.readFileSync(out).toString("base64");

    return normalizedFile("تم تحويل Word إلى PDF.", out, "converted.pdf", base64);
  } catch (err) {
    return normalizedError("فشل تحويل DOCX.", err);
  }
}

/* ============================================================
   🟧 MODIFY – تعديل DOCX
   ============================================================ */
async function modifyDOCX(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    const result = await mammoth.extractRawText({ buffer });

    const modifiedText = `تم تعديل المستند:\n\n${result.value}`;
    const out = path.join(path.dirname(filePath), `modified_${Date.now()}.txt`);

    fs.writeFileSync(out, modifiedText);

    const base64 = fs.readFileSync(out).toString("base64");

    return normalizedFile("تم تعديل Word.", out, "modified.txt", base64);
  } catch (err) {
    return normalizedError("فشل تعديل DOCX.", err);
  }
}

/* ============================================================
   🟪 ANALYZE – تحليل DOCX
   ============================================================ */
async function analyzeDOCX(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    const result = await mammoth.extractRawText({ buffer });

    return normalizedReply("تحليل Word مكتمل.", {
      characters: result.value.length,
      hasImages: result.value.includes("<img"),
      hasTables: result.value.includes("<table")
    });
  } catch (err) {
    return normalizedError("فشل تحليل DOCX.", err);
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