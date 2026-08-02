/**
 * engines/excel.js – Sovereign Excel Gateway & Orchestrator (Absolute Edition)
 * ✅ تم تحديثها لاستخدام @aspose/cells بدلاً من office-oxide
 */

import path from "path";
import fs from "fs";
import os from "os";
import { execSync } from "child_process";
import { Workbook } from "@aspose/cells";

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
    // ✅ استخدام Aspose.Cells لقراءة الملف
    const workbook = new Workbook(filePath);
    const worksheet = workbook.getWorksheets().get(0);
    const cells = worksheet.getCells();

    // استخراج البيانات
    const data = [];
    const rows = cells.getMaxDataRow() + 1;
    const cols = cells.getMaxDataColumn() + 1;

    for (let i = 0; i < rows; i++) {
      const row = [];
      for (let j = 0; j < cols; j++) {
        const cell = cells.get(i, j);
        row.push(cell.getValue() || '');
      }
      data.push(row);
    }

    // استخراج الصيغ
    const formulas = [];
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const cell = cells.get(i, j);
        if (cell.getFormula()) {
          formulas.push(`الخلية ${String.fromCharCode(65 + j)}${i + 1}: ${cell.getFormula()}`);
        }
      }
    }

    const result = {
      text: data.map(row => row.join(' | ')).join('\n'),
      markdown: data.map(row => `| ${row.join(' | ')} |`).join('\n'),
      metadata: {
        sheets: workbook.getWorksheets().getCount(),
        rows: rows,
        columns: cols,
        hasFormulas: formulas.length > 0,
        formulas: formulas.slice(0, 20)
      }
    };
    
    return normalizedReply("📊 تم قراءة ملف Excel بنجاح باستخدام Aspose.Cells.", result);
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
    // ✅ استخدام Aspose.Cells للتعديل
    const workbook = new Workbook(filePath);
    const worksheet = workbook.getWorksheets().get(0);
    const cells = worksheet.getCells();

    // تطبيق التعديلات
    if (params.instruction) {
      // مثال: إضافة عمود جديد
      const lastCol = cells.getMaxDataColumn();
      const newCol = lastCol + 1;
      
      // إضافة عنوان العمود
      const headerCell = cells.get(0, newCol);
      headerCell.putValue("تم التعديل");
      
      // تعبئة البيانات
      const rows = cells.getMaxDataRow();
      for (let i = 1; i <= rows; i++) {
        const cell = cells.get(i, newCol);
        cell.putValue(`تم التعديل في الصف ${i+1}`);
      }
    }

    // حفظ الملف المعدل
    const outPath = path.join(os.tmpdir(), `modified_${Date.now()}.xlsx`);
    workbook.save(outPath);

    const base64 = fs.readFileSync(outPath).toString('base64');
    return normalizedFile("✅ تم تعديل الملف بنجاح.", outPath, "modified.xlsx", base64);
  } catch (err) {
    console.error("❌ خطأ في excelModify:", err);
    return normalizedError("فشل تعديل ملف Excel.", err);
  }
}

export async function excelCreate(params = {}) {
  try {
    // ✅ استخدام Aspose.Cells لإنشاء ملف جديد
    const workbook = new Workbook();
    const worksheet = workbook.getWorksheets().get(0);
    const cells = worksheet.getCells();

    // كتابة البيانات الأولية
    const headers = params.headers || ['العمود 1', 'العمود 2', 'العمود 3'];
    for (let i = 0; i < headers.length; i++) {
      cells.get(0, i).putValue(headers[i]);
    }

    // إضافة بيانات افتراضية
    if (params.data) {
      for (let i = 0; i < params.data.length; i++) {
        const row = params.data[i];
        for (let j = 0; j < row.length; j++) {
          cells.get(i + 1, j).putValue(row[j]);
        }
      }
    }

    const outPath = path.join(os.tmpdir(), `created_${Date.now()}.xlsx`);
    workbook.save(outPath);

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
