/**
 * engines/excel.js – Sovereign Unified Excel Engine (Heavy Edition - Fixed)
 * نسخة موحّدة ومحصّنة ضد الملفات التي لا تحتوي على ترويسة أو تبدأ ببيانات مباشرة
 */

import fs from "fs";
import path from "path";
import XLSX from "xlsx";
import ExcelJS from "exceljs";
import { execSync } from "child_process";

/* ============================================================
   🟩 واجهات التصدير المتوافقة مع external_file_bridge.js
   ============================================================ */
export async function excelRead(filePath) {
  return await readExcel(filePath);
}

export async function excelModify(filePath, fn = null) {
  return await modifyExcel(filePath);
}

export async function excelCreate(text = "") {
  return normalizedReply("إنشاء ملف Excel غير مفعّل بعد.", { text });
}

/* ============================================================
   🟥 واجهة المحرك الموحدة
   ============================================================ */
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
   🟩 READ – قراءة Excel (محصنة ضد غياب الترويسة)
   ============================================================ */
async function readExcel(filePath) {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // المحاولة الأولى: القراءة بالشكل القياسي (مع ترويسة)
    let sheetData = XLSX.utils.sheet_to_json(worksheet);

    // المحاولة الثانية: إذا كانت النتيجة فارغة، نقرأ الملف كصفوف خام (Arrays) لضمان عدم ضياع أي بيانات
    if (!sheetData || sheetData.length === 0) {
      const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      // تصفية الأسطر الفارغة تماماً
      const filteredRows = rawData.filter(row => Array.isArray(row) && row.some(cell => cell !== undefined && cell !== ""));
      
      if (filteredRows.length > 0) {
        // تحويل الصفوف الخام إلى كائنات مبسطة ليفهمها النموذج
        const headers = filteredRows[0];
        sheetData = filteredRows.slice(1).map(row => {
          let obj = {};
          headers.forEach((h, i) => {
            obj[h || `col_${i}`] = row[i] !== undefined ? row[i] : "";
          });
          return obj;
        });
        
        // إذا لم يكن هناك ترويسة حقيقية، نرسل الصفوف الخام مباشرة كمعاينة
        if (sheetData.length === 0) {
          sheetData = filteredRows.map((r, idx) => ({ row_index: idx, data: r }));
        }
      }
    }

    if (!sheetData || sheetData.length === 0) {
      return normalizedError("الملف فارغ تماماً أو لا يحتوي على بيانات قراءة صالحة.");
    }

    return normalizedReply("تم قراءة ملف Excel بنجاح.", {
      sheetName,
      rows: sheetData.length,
      preview: sheetData.slice(0, 15) // نأخذ أول 15 صفاً كمعاينة دقيقة
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
      const ws = workbook.Sheets[name];
      let data = XLSX.utils.sheet_to_json(ws);
      if (!data || data.length === 0) {
        data = XLSX.utils.sheet_to_json(ws, { header: 1 });
      }
      sheets[name] = data;
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
    const ws = workbook.Sheets[sheetName];
    let sheet = XLSX.utils.sheet_to_json(ws);

    if (!sheet || sheet.length === 0) {
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1 });
      sheet = raw.map((r, i) => ({ index: i, content: r }));
    }

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

