/**
 * engines/excel.js – Sovereign Excel Bridge Engine (Pandas Unified Edition)
 * نسخة موحّدة توجّه العمليات البرمجية مباشرة نحو محرك Pandas السيادي
 */

import path from "path";
import { execSync } from "child_process";
import fs from "fs";
import pandasEngine from "./pandas.js";

/* ============================================================
   🟩 واجهات التصدير المتوافقة مع external_file_bridge.js
   ============================================================ */
export async function excelRead(filePath) {
  return await pandasEngine(filePath, "read");
}

export async function excelModify(filePath, fn = null) {
  return await pandasEngine(filePath, "modify", { fn });
}

export async function excelCreate(text = "") {
  return { ok: false, reply: "إنشاء ملف Excel يتم عبر أدوات الوكيل المباشرة.", data: { text } };
}

/* ============================================================
   🟥 واجهة المحرك الموحدة (موجّهة نحو Pandas و LibreOffice)
   ============================================================ */
export default async function excelEngine(filePath, action, params = {}) {
  try {
    switch (action) {
      case "read":
      case "analyze":
      case "extract":
      case "modify":
        // توجيه ذكي وسيء نحو عملاق البايثون الموجود في النظام
        return await pandasEngine(filePath, action, params);

      case "convert":
        return await convertExcelToPdf(filePath);

      default:
        return normalizedError("عملية غير معروفة لملف Excel.");
    }
  } catch (err) {
    return normalizedError("خطأ أثناء معالجة Excel.", err);
  }
}

/* ============================================================
   🟥 CONVERT – تحويل Excel → PDF عبر LibreOffice (أداة نظام ثقيلة)
   ============================================================ */
function convertExcelToPdf(filePath) {
  try {
    const out = path.join(path.dirname(filePath), `converted_${Date.now()}.pdf`);
    execSync(`libreoffice --headless --convert-to pdf "${filePath}" --outdir "${path.dirname(filePath)}"`);
    
    // التعامل مع تسمية الإخراج التلقائية من LibreOffice
    const defaultPdfName = path.basename(filePath, path.extname(filePath)) + ".pdf";
    const generatedPdfPath = path.join(path.dirname(filePath), defaultPdfName);
    
    let finalPdfPath = out;
    if (fs.existsSync(generatedPdfPath)) {
      if (generatedPdfPath !== out) {
        fs.renameSync(generatedPdfPath, out);
      }
    } else {
      throw new Error("فشل توليد ملف PDF عبر محرك النظام.");
    }

    const base64 = fs.readFileSync(out).toString("base64");
    return normalizedFile("تم تحويل Excel إلى PDF بنجاح.", out, "converted.pdf", base64);
  } catch (err) {
    return normalizedError("فشل تحويل Excel إلى PDF.", err);
  }
}

/* ============================================================
   🟫 طبقة توحيد الردود (نفس المعمارية)
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
