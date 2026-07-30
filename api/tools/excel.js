/**
 * api/tools/excel.js – Sovereign Excel Engine (Final Edition)
 * محرك Excel سيادي بالكامل بدون أي ذكاء لغوي أو استدعاءات خارجية
 */

import fs from "fs";
import ExcelJS from "exceljs";
import { safeTempFile, safeUnlink, extractCellValue } from "./helpers.js";

/* ============================================================
   🟥 قراءة ملف Excel
   ============================================================ */
export async function excelRead(filePath) {
  try {
    if (!filePath || !fs.existsSync(filePath)) {
      return "⚠️ ملف Excel غير موجود.";
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    let output = "";

    workbook.eachSheet((sheet) => {
      output += `📄 Sheet: ${sheet.name}\n`;

      sheet.eachRow({ includeEmpty: false }, (row) => {
        const values = (row.values || [])
          .slice(1)
          .map((v) => extractCellValue(v));

        if (values.some(Boolean)) {
          output += values.join(" | ") + "\n";
        }
      });

      output += "\n";
    });

    return output.trim() || "⚠️ الملف فارغ.";
  } catch (err) {
    return `⚠️ فشل قراءة Excel: ${err.message}`;
  }
}

/* ============================================================
   🟦 تعديل Excel بدون ذكاء لغوي
   ============================================================ */
export async function excelModify(filePath, modifyFn) {
  let outPath = null;

  try {
    if (typeof modifyFn !== "function") {
      throw new Error("دالة التعديل غير صالحة.");
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const sheet = workbook.worksheets[0];
    if (!sheet) throw new Error("لا يوجد ورقة عمل.");

    // تعديل الصفوف عبر دالة محلية
    sheet.eachRow((row) => {
      const values = row.values.slice(1).map((v) => extractCellValue(v));
      const newValues = modifyFn(values);

      if (Array.isArray(newValues)) {
        row.values = [null, ...newValues];
      }
    });

    outPath = safeTempFile("xlsx");
    await workbook.xlsx.writeFile(outPath);

    const buffer = fs.readFileSync(outPath);

    return {
      fileBase64: buffer.toString("base64"),
      fileName: `modified_${Date.now()}.xlsx`
    };
  } catch (err) {
    return { error: `⚠️ فشل تعديل Excel: ${err.message}` };
  } finally {
    safeUnlink(outPath);
  }
}

/* ============================================================
   🟧 إنشاء Excel من نص منسق
   ============================================================ */
export async function excelCreate(textContent) {
  let outPath = null;

  try {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Sheet1");

    const lines = textContent.split("\n").filter((l) => l.includes("|"));

    lines.forEach((line, index) => {
      const parts = line.split("|").map((x) => x.trim());
      const row = sheet.addRow(parts);

      if (index === 0) {
        row.font = { bold: true };
      }
    });

    outPath = safeTempFile("xlsx");
    await workbook.xlsx.writeFile(outPath);

    const buffer = fs.readFileSync(outPath);

    return {
      fileBase64: buffer.toString("base64"),
      fileName: `created_${Date.now()}.xlsx`
    };
  } catch (err) {
    return { error: `⚠️ فشل إنشاء Excel: ${err.message}` };
  } finally {
    safeUnlink(outPath);
  }
}