/**
 * engines/excel.js – Sovereign Unified Excel Engine (Heavy Edition)
 * نسخة موحّدة بالكامل مع باقي المحركات
 */

import fs from "fs";
import path from "path";
import XLSX from "xlsx";
import ExcelJS from "exceljs";
import { execSync } from "child_process";

export default async function excelEngine(filePath, action, params = {}) {
  try {
    switch (action) {
      case "read":
        return await readExcel(filePath);

      case "extract":
        return await extractExcel(filePath);

      case "convert":
        return await convertExcel(filePath);

      case "modify":
        return await modifyExcel(filePath);

      case "analyze":
        return await analyzeExcel(filePath);

      default:
        return normalizedError("عملية غير معروفة.");
    }
  } catch (err) {
    return normalizedError("خطأ أثناء معالجة Excel.", err);
  }
}

/* ============================================================
   🟩 READ – قراءة Excel
   ============================================================ */
async function readExcel(filePath) {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    return normalizedReply("تم قراءة ملف Excel بنجاح.", {
      sheetName,
      rows: sheet.length,
      preview: sheet.slice(0, 10)
    });
  } catch (err) {
    return normalizedError("فشل قراءة Excel.", err);
  }
}

/* ============================================================
   🟦 EXTRACT – استخراج جميع الجداول
   ============================================================ */
async function extractExcel(filePath) {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheets = {};

    workbook.SheetNames.forEach(name => {
      sheets[name] = XLSX.utils.sheet_to_json(workbook.Sheets[name]);
    });

    return normalizedReply("تم استخراج جميع جداول Excel.", sheets);
  } catch (err) {
    return normalizedError("فشل استخراج Excel.", err);
  }
}

/* ============================================================
   🟥 CONVERT – تحويل Excel → PDF
   ============================================================ */
async function convertExcel(filePath) {
  try {
    const out = path.join(path.dirname(filePath), `converted_${Date.now()}.pdf`);

    execSync(`libreoffice --headless --convert-to pdf "${filePath}" --outdir "${path.dirname(out)}"`);

    const base64 = fs.readFileSync(out).toString("base64");

    return normalizedFile("تم تحويل Excel إلى PDF.", out, "converted.pdf", base64);
  } catch (err) {
    return normalizedError("فشل تحويل Excel.", err);
  }
}

/* ============================================================
   🟧 MODIFY – تعديل Excel (إضافة صف)
   ============================================================ */
async function modifyExcel(filePath) {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const sheet = workbook.worksheets[0];
    sheet.addRow(["تم التعديل", new Date().toISOString()]);

    const out = path.join(path.dirname(filePath), `modified_${Date.now()}.xlsx`);
    await workbook.xlsx.writeFile(out);

    const base64 = fs.readFileSync(out).toString("base64");

    return normalizedFile("تم تعديل Excel (إضافة صف جديد).", out, "modified.xlsx", base64);
  } catch (err) {
    return normalizedError("فشل تعديل Excel.", err);
  }
}

/* ============================================================
   🟪 ANALYZE – تحليل Excel
   ============================================================ */
async function analyzeExcel(filePath) {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    return normalizedReply("تحليل Excel مكتمل.", {
      sheetName,
      rows: sheet.length,
      columns: Object.keys(sheet[0] || {}),
      sample: sheet[0] || {}
    });
  } catch (err) {
    return normalizedError("فشل تحليل Excel.", err);
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