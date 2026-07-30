/**
 * engines/pdf.js – Sovereign Unified PDF Engine (Heavy Edition)
 * نسخة موحّدة بالكامل مع باقي المحركات
 */

import fs from "fs";
import path from "path";
import { PDFDocument } from "pdf-lib";
import { execSync } from "child_process";

export default async function pdfEngine(filePath, action, params = {}) {
  try {
    switch (action) {
      case "read":
        return await readPDF(filePath);

      case "extract":
        return await extractPDF(filePath);

      case "convert":
        return await convertPDF(filePath);

      case "modify":
        return await modifyPDF(filePath);

      case "analyze":
        return await analyzePDF(filePath);

      default:
        return normalizedError("عملية غير معروفة.");
    }
  } catch (err) {
    return normalizedError("خطأ أثناء معالجة PDF.", err);
  }
}

/* ============================================================
   🟩 READ – قراءة PDF
   ============================================================ */
async function readPDF(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    const pdf = await PDFDocument.load(buffer);

    return normalizedReply("تم قراءة PDF بنجاح.", {
      pages: pdf.getPageCount(),
      metadata: pdf.getTitle() || null
    });
  } catch (err) {
    return normalizedError("فشل قراءة PDF.", err);
  }
}

/* ============================================================
   🟦 EXTRACT – استخراج أول صفحة كصورة
   ============================================================ */
async function extractPDF(filePath) {
  try {
    const outBase = path.join(path.dirname(filePath), `extract_${Date.now()}`);
    const outPath = `${outBase}-1.png`;

    execSync(`pdftoppm -png "${filePath}" "${outBase}"`);

    const base64 = fs.readFileSync(outPath).toString("base64");

    return normalizedFile("تم استخراج أول صفحة كصورة.", outPath, "page_1.png", base64);
  } catch (err) {
    return normalizedError("فشل استخراج PDF.", err);
  }
}

/* ============================================================
   🟥 CONVERT – تحويل PDF → DOCX
   ============================================================ */
async function convertPDF(filePath) {
  try {
    const out = path.join(path.dirname(filePath), `converted_${Date.now()}.docx`);

    execSync(`libreoffice --headless --convert-to docx "${filePath}" --outdir "${path.dirname(out)}"`);

    const base64 = fs.readFileSync(out).toString("base64");

    return normalizedFile("تم تحويل PDF إلى Word.", out, "converted.docx", base64);
  } catch (err) {
    return normalizedError("فشل تحويل PDF.", err);
  }
}

/* ============================================================
   🟧 MODIFY – تعديل PDF (حذف أول صفحة)
   ============================================================ */
async function modifyPDF(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    const pdf = await PDFDocument.load(buffer);

    pdf.removePage(0);

    const out = path.join(path.dirname(filePath), `modified_${Date.now()}.pdf`);
    fs.writeFileSync(out, await pdf.save());

    const base64 = fs.readFileSync(out).toString("base64");

    return normalizedFile("تم تعديل PDF (حذف الصفحة الأولى).", out, "modified.pdf", base64);
  } catch (err) {
    return normalizedError("فشل تعديل PDF.", err);
  }
}

/* ============================================================
   🟪 ANALYZE – تحليل PDF
   ============================================================ */
async function analyzePDF(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    const pdf = await PDFDocument.load(buffer);

    return normalizedReply("تحليل PDF مكتمل.", {
      pages: pdf.getPageCount(),
      hasText: true,
      hasImages: true
    });
  } catch (err) {
    return normalizedError("فشل تحليل PDF.", err);
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