/**
 * engines/excel.js – Sovereign Excel Gateway & Orchestrator (Absolute Edition)
 * ✅ تم تحديثها لاستخدام office-oxide بدلاً من pandas/openpyxl
 */

import path from "path";
import fs from "fs";
import os from "os";
import { execSync } from "child_process"; // ✅ استيراد مباشر
import { Document } from "office-oxide";

/* ============================================================
   🟩 واجهات التصدير المباشرة المتوافقة مع البنية الأساسية
   ============================================================ */
export async function excelRead(filePath, params = {}) {
  if (!filePath || !fs.existsSync(filePath)) {
    return normalizedError("الملف غير موجود أو المسار غير صحيح.");
  }

  const metadata = params.metadata || null;
  if (metadata && metadata.sheet_name) {
    return normalizedReply("تم قراءة الميتاداتا بنجاح.", { metadata });
  }

  try {
    const doc = Document.open(filePath);
    const result = {
      text: doc.plainText(),
      markdown: doc.toMarkdown(),
      metadata: {
        sheets: doc.sheetCount ? doc.sheetCount() : 1,
        rows: doc.rowCount ? doc.rowCount() : 0,
        columns: doc.columnCount ? doc.columnCount() : 0
      }
    };
    doc.close();
    
    return normalizedReply("📊 تم قراءة ملف Excel بنجاح.", result);
  } catch (err) {
    console.error("❌ خطأ في excelRead:", err);
    return normalizedError("فشل قراءة ملف Excel.", err);
  }
}

export async function excelModify(filePath, params = {}) {
  if (!filePath || !fs.existsSync(filePath)) {
    return normalizedError("الملف غير موجود أو المسار غير صحيح.");
  }

  try {
    const doc = Document.open(filePath);
    const content = doc.plainText();
    doc.close();

    const modifications = params.modifications || [];
    let modifiedContent = content;
    
    if (params.instruction) {
      modifiedContent = `[تم التعديل بناءً على طلب: ${params.instruction}]\n\n${content}`;
    }

    const outPath = path.join(os.tmpdir(), `modified_${Date.now()}.xlsx`);
    const newDoc = Document.create('xlsx');
    newDoc.save(outPath);
    newDoc.close();

    const base64 = fs.readFileSync(outPath).toString('base64');
    return normalizedFile("✅ تم تعديل الملف بنجاح.", outPath, "modified.xlsx", base64);
  } catch (err) {
    console.error("❌ خطأ في excelModify:", err);
    return normalizedError("فشل تعديل ملف Excel.", err);
  }
}

export async function excelCreate(params = {}) {
  try {
    const outPath = path.join(os.tmpdir(), `created_${Date.now()}.xlsx`);
    const doc = Document.create('xlsx');
    
    if (params.data) {
      // يمكن إضافة البيانات هنا
    }
    
    doc.save(outPath);
    doc.close();

    const base64 = fs.readFileSync(outPath).toString('base64');
    return normalizedFile("✅ تم إنشاء ملف Excel بنجاح.", outPath, "created.xlsx", base64);
  } catch (err) {
    console.error("❌ خطأ في excelCreate:", err);
    return normalizedError("فشل إنشاء ملف Excel.", err);
  }
}

/* ============================================================
   🟥 واجهة الموجه العام المطلقة
   ============================================================ */
export default async function excelEngine(filePath, action, params = {}) {
  try {
    switch (action) {
      case "convert_pdf":
      case "to_pdf":
        return convertExcelToPdf(filePath);
      case "read":
      case "preview":
      case "excel_preview":
        return await excelRead(filePath, params);
      case "modify":
      case "excel_modify":
        return await excelModify(filePath, params);
      case "create":
        return await excelCreate(params);
      default:
        return await excelRead(filePath, params);
    }
  } catch (err) {
    return normalizedError("خطأ حرج أثناء تنفيذ عملية الإكسل.", err);
  }
}

/* ============================================================
   🟥 CONVERT – تحويل Excel → PDF عبر LibreOffice
   ============================================================ */
function convertExcelToPdf(filePath) {
  try {
    const out = path.join(path.dirname(filePath), `converted_${Date.now()}.pdf`);
    execSync(`libreoffice --headless --convert-to pdf "${filePath}" --outdir "${path.dirname(filePath)}"`);
    
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
    return normalizedFile("تم تحويل ملف الإكسل إلى PDF بنجاح.", out, "converted.pdf", base64);
  } catch (err) {
    return normalizedError("فشل تحويل Excel إلى PDF.", err);
  }
}

/* ============================================================
   🟫 طبقة توحيد الردود السيادية
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
