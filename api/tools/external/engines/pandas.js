/**
 * engines/pandas.js – Sovereign Unconstrained Python/Pandas Engine
 * محرك سيادي مطلق يستغل القدرات الكاملة لـ Pandas و Openpyxl بدون أي قيود أو تحجيم
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";

export default async function pandasEngine(filePath, action, params = {}) {
  try {
    switch (action) {
      case "read":
      case "analyze":
        return await runPythonPandas(filePath, "analyze");

      case "extract":
        return await runPythonPandas(filePath, "extract");

      case "convert":
        return await runPythonConvert(filePath, params);

      case "modify":
        return await runPythonModify(filePath);

      default:
        return normalizedError("عملية غير معروفة.");
    }
  } catch (err) {
    return normalizedError("خطأ أثناء معالجة محرك Pandas.", err);
  }
}

/* ============================================================
   🐍 محرك بايثون المطلق (بدون قيود أو تصفية مسبقة)
   ============================================================ */
function runPythonPandas(filePath, mode) {
  try {
    const pythonScript = `
import pandas as pd
import json
import sys

try:
    file_path = sys.argv[1]
    
    if file_path.endswith(('.xlsx', '.xls')):
        # استكشاف كافة الأوراق (Sheets) الموجودة في ملف الإكسل
        xls = pd.ExcelFile(file_path)
        sheets_data = {}
        
        for sheet in xls.sheet_names:
            # قراءة الورقة بكل مرونة دون فرض أي افتراضات مسبقة
            df = pd.read_excel(file_path, sheet_name=sheet)
            
            # تنظيف الفراغات التامة فقط للحفاظ على نظافة الهيكل
            df = df.dropna(how='all', axis=0).dropna(how='all', axis=1)
            
            # تحويل الأعمدة لنصوص آمنة
            df.columns = [str(c) for c in df.columns]
            
            sheets_data[sheet] = {
                "rows": len(df),
                "columns": list(df.columns),
                "preview": df.head(50).fillna("").to_dict(orient="records")
            }
            
        result = {
            "ok": True,
            "reply": f"تم استقراء ملف Excel بنجاح عبر محرك Pandas السيادي (يحتوي على الأوراق: {list(xls.sheet_names)})",
            "data": {
                "sheets": sheets_data,
                "multi_sheet": True
            }
        }
    else:
        # ملفات CSV والملفات النصية المهيكلة
        df = pd.read_csv(file_path)
        df = df.dropna(how='all', axis=0).dropna(how='all', axis=1)
        df.columns = [str(c) for c in df.columns]
        
        result = {
            "ok": True,
            "reply": "تمت قراءة ملف البيانات بنجاح.",
            "data": {
                "sheets": {
                    "Sheet1": {
                        "rows": len(df),
                        "columns": list(df.columns),
                        "preview": df.head(50).fillna("").to_dict(orient="records")
                    }
                },
                "multi_sheet": False
            }
        }
        
    print(json.dumps(result, ensure_ascii=False))
except Exception as e:
    error_res = {"ok": False, "reply": "فشل تحليل البيانات عبر بايثون.", "error": str(e)}
    print(json.dumps(error_res, ensure_ascii=False))
`;

    const scriptPath = path.join(path.dirname(filePath), `script_${Date.now()}.py`);
    fs.writeFileSync(scriptPath, pythonScript, "utf8");

    const output = execSync(`python3 "${scriptPath}" "${filePath}"`, { encoding: "utf-8" });
    
    if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath);

    const parsed = JSON.parse(output.trim());
    if (!parsed.ok) {
      return normalizedError(parsed.reply, new Error(parsed.error));
    }
    return parsed;

  } catch (err) {
    return normalizedError("خطأ في تشغيل بيئة بايثون.", err);
  }
}

/* ============================================================
   🟥 CONVERT – تحويل الملفات عبر Pandas
   ============================================================ */
function runPythonConvert(filePath, params) {
  try {
    const ext = params.format || "json";
    const outPath = path.join(path.dirname(filePath), `converted_${Date.now()}.${ext}`);

    const pythonScript = `
import pandas as pd
import sys

file_path = sys.argv[1]
out_path = sys.argv[2]
ext = sys.argv[3]

if file_path.endswith(('.xlsx', '.xls')):
    df = pd.read_excel(file_path, sheet_name=0)
else:
    df = pd.read_csv(file_path)

if ext == 'json':
    df.to_json(out_path, orient='records', force_ascii=False, indent=2)
elif ext == 'csv':
    df.to_csv(out_path, index=False)
elif ext == 'xlsx':
    df.to_excel(out_path, index=False)
print("SUCCESS")
`;
    const scriptPath = path.join(path.dirname(filePath), `conv_${Date.now()}.py`);
    fs.writeFileSync(scriptPath, pythonScript, "utf8");

    execSync(`python3 "${scriptPath}" "${filePath}" "${outPath}" "${ext}"`, { encoding: "utf-8" });
    if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath);

    const base64 = fs.readFileSync(outPath).toString("base64");
    return normalizedFile(`تم التحويل إلى ${ext} بنجاح عبر Pandas.`, outPath, `converted.${ext}`, base64);
  } catch (err) {
    return normalizedError("فشل تحويل البيانات.", err);
  }
}

/* ============================================================
   🟧 MODIFY – تعديل البيانات
   ============================================================ */
function runPythonModify(filePath) {
  try {
    const outPath = path.join(path.dirname(filePath), `modified_${Date.now()}.xlsx`);
    
    const pythonScript = `
import pandas as pd
import sys

file_path = sys.argv[1]
out_path = sys.argv[2]

if file_path.endswith(('.xlsx', '.xls')):
    df = pd.read_excel(file_path, sheet_name=0)
else:
    df = pd.read_csv(file_path)

new_row = {col: "تم التعديل" for col in df.columns}
df.loc[len(df)] = new_row

if file_path.endswith(('.xlsx', '.xls')):
    df.to_excel(outPath, index=False)
else:
    df.to_csv(outPath, index=False)
print("SUCCESS")
`;
    const scriptPath = path.join(path.dirname(filePath), `mod_${Date.now()}.py`);
    fs.writeFileSync(scriptPath, pythonScript, "utf8");

    execSync(`python3 "${scriptPath}" "${filePath}" "${outPath}"`, { encoding: "utf-8" });
    if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath);

    const base64 = fs.readFileSync(outPath).toString("base64");
    return normalizedFile("تم تعديل البيانات عبر Pandas بنجاح.", outPath, "modified.xlsx", base64);
  } catch (err) {
    return normalizedError("فشل تعديل البيانات.", err);
  }
}

/* ============================================================
   🟫 طبقة توحيد الردود
   ============================================================ */
function normalizedReply(reply, data = {}) {
  return { ok: true, reply, data, fileBase64: null, fileName: null, filePath: null };
}

function normalizedFile(reply, filePath, fileName, base64) {
  return { ok: true, reply, data: null, fileBase64: base64, fileName, filePath };
}

function normalizedError(reply, err = null) {
  return { ok: false, reply, error: err ? err.message : reply, data: null, fileBase64: null, fileName: null, filePath: null };
}

