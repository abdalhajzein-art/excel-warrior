/**
 * engines/excel.js – Sovereign Excel Gateway & Orchestrator (Absolute Edition)
 * بوابة سيادية شاملة وغير مقيدة لتوجيه كافة عمليات وقدرات Pandas و Openpyxl البرمجية والبصرية دون أي استنزاف لتوكنز النموذج.
 */

import path from "path";
import { execSync } from "child_process";
import fs from "fs";
import pandasEngine from "./pandas.js";

/* ============================================================
   🟩 واجهات التصدير المباشرة المتوافقة مع البنية الأساسية
   ============================================================ */
export async function excelRead(filePath, params = {}) {
  return await pandasEngine(filePath, "read", params);
}

export async function excelModify(filePath, params = {}) {
  return await pandasEngine(filePath, "modify", params);
}

export async function excelCreate(params = {}) {
  // تمرير طلب الإنشاء المباشر لمحرك بايثون لتوليد ملف إكسل احترافي عبر openpyxl
  return await pandasEngine(filePathDummyForCreate(), "create", params);
}

function filePathDummyForCreate() {
  return path.join(os.tmpdir(), `dummy_${Date.now()}.xlsx`);
}

/* ============================================================
   🟥 واجهة الموجه العام المفتوحة (Omnipotent Excel Dispatcher)
   ============================================================ */
export default async function excelEngine(filePath, action, params = {}) {
  try {
    // ⚡ تمرير أي عملية مهما كانت (قراءة، تحليل، تجميع، Pivot، تعديل، تنسيق، رسوم بيانية، صيغ)
    // مباشرة إلى محرك Pandas & Openpyxl السيادي لتنفيذها برمجياً في البيئة المحلية.
    switch (action) {
      case "convert_pdf":
      case "to_pdf":
        return convertExcelToPdf(filePath);

      default:
        // أي عملية أخرى (read, analyze, transform, aggregate, pivot, style, format, chart, modify, create)
        // يتم تفويضها بالكامل للمحرك الماستر ليقوم بتطبيقها عبر بايثون.
        return await pandasEngine(filePath, action, params);
    }
  } catch (err) {
    return normalizedError("خطأ حرج أثناء تنفيذ عملية الإكسل عبر المحرك السيادي.", err);
  }
}

/* ============================================================
   🟥 CONVERT – تحويل Excel → PDF عبر LibreOffice (أداة طباعة ثقيلة ودقيقة)
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
    return normalizedFile("تم تحويل ملف الإكسل إلى PDF بنجاح مع الحفاظ على التنسيق.", out, "converted.pdf", base64);
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

