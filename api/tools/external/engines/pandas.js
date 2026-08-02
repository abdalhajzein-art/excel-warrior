/**
 * engines/pandas.js – Sovereign Excel Engine (Openpyxl + Metadata + CSV + RAW Fallback Edition)
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";

export default async function pandasEngine(filePath, action, params = {}) {
  try {
    // ✅ إذا كانت الميتاداتا موجودة، نقرأها مباشرة (تجاوز openpyxl)
    if (params.metadata && params.metadata.sheet_name) {
      console.log(`📋 [pandasEngine] تم استخدام الميتاداتا المرفقة: ${params.metadata.sheet_name}`);
      return {
        ok: true,
        reply: "📊 تم قراءة الميتاداتا بنجاح (تجاوز openpyxl).",
        data: { metadata: params.metadata },
        fileBase64: null,
        fileName: null,
        isMetadata: true
      };
    }

    // ✅ التحقق من وجود الملف
    if (!filePath || !fs.existsSync(filePath)) {
      return normalizedError("الملف غير موجود: " + filePath);
    }

    // ✅ التحقق من أن الملف هو Excel حقيقي (ZIP-based)
    const isRealExcel = await isExcelFile(filePath);
    
    // ✅ إذا لم يكن Excel حقيقياً، حاول قراءته كنصي أو CSV
    if (!isRealExcel) {
      console.log(`📄 [pandasEngine] الملف ليس Excel حقيقياً، محاولة قراءته كنصي/CSV.`);
      const textResult = await tryReadAsTextOrCsv(filePath);
      
      // ✅ إذا فشل CSV والنصي، نرجع النص الخام كحل أخير
      if (textResult.ok === false) {
        console.log(`📄 [pandasEngine] فشل قراءة الملف كنصي/CSV، محاولة قراءته كنص خام.`);
        return await tryReadAsRawText(filePath);
      }
      
      return textResult;
    }

    switch (action) {
      case "preview":
      case "read":
      case "excel_preview":
        return await runOpenpyxlPreview(filePath);

      case "modify":
      case "excel_modify":
      case "openpyxl_manipulate":
        return await runPythonDynamicExecutor(filePath, params);

      default:
        return await runOpenpyxlPreview(filePath);
    }
  } catch (err) {
    return normalizedError("خطأ في محرك Excel السيادي.", err);
  }
}

/**
 * 🛡️ كشف ما إذا كان الملف Excel حقيقياً (ZIP-based)
 */
async function isExcelFile(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    const header = buffer.slice(0, 4).toString();
    return header === "PK" || header === "PK\x03\x04";
  } catch {
    return false;
  }
}

/**
 * 📄 محاولة قراءة الملف كنصي أو CSV (إذا فشل openpyxl)
 */
async function tryReadAsTextOrCsv(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf-8');
    
    if (!content || content.trim().length === 0) {
      return normalizedError("⚠️ الملف فارغ أو لا يحتوي على بيانات.");
    }

    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length > 1) {
      const firstLine = lines[0];
      const hasDelimiter = /[,\t;|]/.test(firstLine);
      if (hasDelimiter) {
        const headers = firstLine.split(/[,\t;|]/).map(h => h.trim());
        const rows = lines.slice(1).map(line => line.split(/[,\t;|]/).map(cell => cell.trim()));
        
        return {
          ok: true,
          reply: "📊 تم قراءة الملف كنصي/CSV (تم تجاوز openpyxl).",
          data: {
            headers: headers,
            rows: rows.slice(0, 100),
            totalRows: rows.length,
            totalColumns: headers.length
          },
          fileBase64: null,
          fileName: null
        };
      }
    }

    return {
      ok: true,
      reply: "📄 تم قراءة الملف كنصي.",
      data: {
        text: content.slice(0, 5000),
        totalLength: content.length
      },
      fileBase64: null,
      fileName: null
    };

  } catch (err) {
    return normalizedError("فشل قراءة الملف كنصي: " + err.message);
  }
}

/**
 * 📄 ✅ الحل الأخير: قراءة الملف كنص خام (RAW) بدون أي معالجة
 */
async function tryReadAsRawText(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    if (!content || content.trim().length === 0) {
      return normalizedError("⚠️ الملف فارغ أو لا يحتوي على بيانات.");
    }

    return {
      ok: true,
      reply: "📄 تم قراءة الملف كنص خام (RAW).",
      data: {
        raw: content.slice(0, 10000),
        totalLength: content.length,
        note: "تم قراءة الملف كنص خام لأن openpyxl و CSV فشلا في قراءته."
      },
      fileBase64: null,
      fileName: null
    };

  } catch (err) {
    return normalizedError("فشل قراءة الملف كنص خام: " + err.message);
  }
}

/* ============================================================
   🟦 قراءة Excel عبر openpyxl فقط
   ============================================================ */
function runOpenpyxlPreview(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return normalizedError("الملف غير موجود: " + filePath);
    }

    const pythonScript = `
import json
from openpyxl import load_workbook

file_path = "${filePath}"

try:
    wb = load_workbook(file_path, data_only=True)
except Exception as e:
    print(json.dumps({"ok": False, "reply": f"فشل تحميل الملف: {str(e)}"}))
    exit(1)

sheets = {}

for sheet_name in wb.sheetnames:
    ws = wb[sheet_name]
    sample = []
    for row in ws.iter_rows(min_row=1, max_row=10, values_only=True):
        sample.append([str(v) if v is not None else "" for v in row])

    sheets[sheet_name] = {
        "total_rows": ws.max_row,
        "total_columns": ws.max_column,
        "sample_rows": sample
    }

print(json.dumps({"ok": True, "reply": "📊 تمت قراءة الملف بنجاح.", "data": sheets}, ensure_ascii=False))
`;

    const scriptPath = path.join(path.dirname(filePath), `preview_${Date.now()}.py`);
    fs.writeFileSync(scriptPath, pythonScript, "utf8");

    const output = execSync(`python3 "${scriptPath}"`, { encoding: "utf-8" });
    fs.unlinkSync(scriptPath);

    const parsed = JSON.parse(output.trim());
    return normalizedReply(parsed.reply, parsed.data);

  } catch (err) {
    return normalizedError("فشل قراءة الملف عبر openpyxl.", err);
  }
}

/* ============================================================
   ⚡ التنفيذ الديناميكي عبر openpyxl فقط
   ============================================================ */
function runPythonDynamicExecutor(filePath, params = {}) {
  try {
    if (!fs.existsSync(filePath)) {
      return normalizedError("الملف غير موجود: " + filePath);
    }

    const outPath = path.join(path.dirname(filePath), `modified_${Date.now()}.xlsx`);
    const dynamicCode = params.custom_python_code || "";

    const pythonScript = `
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.utils import get_column_letter
import json

file_path = "${filePath}"
out_path = "${outPath}"

try:
    wb = openpyxl.load_workbook(file_path)
except Exception as e:
    print(json.dumps({"ok": False, "reply": f"فشل تحميل الملف للتعديل: {str(e)}"}))
    exit(1)

ws = wb.active

${dynamicCode}

wb.save(out_path)
print(json.dumps({"ok": True, "reply": "تم تعديل الملف بنجاح.", "file_created": True}, ensure_ascii=False))
`;

    const scriptPath = path.join(path.dirname(filePath), `modify_${Date.now()}.py`);
    fs.writeFileSync(scriptPath, pythonScript, "utf8");

    const output = execSync(`python3 "${scriptPath}"`, { encoding: "utf-8" });
    fs.unlinkSync(scriptPath);

    const parsed = JSON.parse(output.trim());

    if (parsed.ok && fs.existsSync(outPath)) {
      const base64 = fs.readFileSync(outPath).toString("base64");
      return normalizedFile(parsed.reply, outPath, "modified.xlsx", base64);
    }

    return normalizedError("فشل تعديل الملف.", new Error("No output file"));

  } catch (err) {
    return normalizedError("فشل تنفيذ التعديل.", err);
  }
}

/* ============================================================
   🟫 طبقة توحيد الردود السيادية
   ============================================================ */
function normalizedReply(reply, data = {}) {
  return { ok: true, reply, data, fileBase64: null, fileName: null };
}

function normalizedFile(reply, filePath, fileName, base64) {
  return { ok: true, reply, data: null, fileBase64: base64, fileName };
}

function normalizedError(reply, err = null) {
  return { ok: false, reply, error: err ? err.message : reply };
      }
