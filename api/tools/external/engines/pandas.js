/**
 * engines/pandas.js – Sovereign Excel Engine (Openpyxl Only Edition)
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";

export default async function pandasEngine(filePath, action, params = {}) {
  try {
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

/* ============================================================
   🟦 قراءة Excel عبر openpyxl فقط
   ============================================================ */
function runOpenpyxlPreview(filePath) {
  try {
    const pythonScript = `
import json
from openpyxl import load_workbook

file_path = "${filePath}"

wb = load_workbook(file_path, data_only=True)
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

wb = openpyxl.load_workbook(file_path)
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
