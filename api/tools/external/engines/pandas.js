/**
 * engines/pandas.js – The Absolute Sovereign Dynamic Pandas & Openpyxl Engine
 * محرك سيادي مطلق ومترجم ديناميكي لكود بايثون بلا قيود.
 * يحترم نية المستخدم: يُرجع بيانات نصية عند العرض/التحليل، ويُرجع ملفاً حقيقياً عند التعديل فقط.
 * صفر توكنز تنفيذية - تشغيل محلي 100%
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";

export default async function pandasEngine(filePath, action, params = {}) {
  try {
    switch (action) {
      case "profile":
      case "analyze":
      case "read":
      case "preview":
      case "excel_preview":
        return await runPythonMasterEngine(filePath, "profile", params);

      case "transform":
      case "aggregate":
      case "pivot":
        return await runPythonMasterEngine(filePath, "transform", params);

      case "style_and_format":
      case "openpyxl_manipulate":
      case "modify":
      case "excel_modify":
        return await runPythonDynamicExecutor(filePath, params);

      case "convert":
        return await runPythonConvert(filePath, params);

      default:
        // إذا توفر كود مخصص، نفذه فوراً وبحسب الناتج قرر الرد
        if (params.custom_python_code) {
          return await runPythonDynamicExecutor(filePath, params);
        }
        return await runPythonMasterEngine(filePath, "profile", params);
    }
  } catch (err) {
    return normalizedError("خطأ حرج في المحرك السيادي المطلق لـ Pandas/Openpyxl.", err);
  }
}

/* ============================================================
   🐍 محرك تحليل وقراءة البيانات (Pandas Powerhouse)
   ============================================================ */
function runPythonMasterEngine(filePath, mode, params = {}) {
  try {
    const paramsJson = JSON.stringify(params);

    const pythonScript = `
import pandas as pd
import numpy as np
import json
import sys
import warnings

# كتم التحذيرات غير الضارة لضمان نظافة المخرجات
warnings.filterwarnings('ignore')

try:
    file_path = sys.argv[1]
    mode = sys.argv[2]
    params = json.loads(sys.argv[3]) if len(sys.argv) > 3 else {}

    if file_path.endswith(('.xlsx', '.xls')):
        xls = pd.ExcelFile(file_path)
        sheet_names = xls.sheet_names
        target_sheet = params.get('sheet', sheet_names[0])
        df = pd.read_excel(file_path, sheet_name=target_sheet)
    else:
        sheet_names = ["Sheet1"]
        df = pd.read_csv(file_path)

    df = df.dropna(how='all', axis=0).dropna(how='all', axis=1)
    df.columns = [str(c).strip() for c in df.columns]

    result_data = {}
    reply_msg = ""

    if mode == "profile":
        total_rows, total_cols = df.shape
        columns_meta = {}
        for col in df.columns:
            columns_meta[col] = {
                "dtype": str(df[col].dtype),
                "null_count": int(df[col].isnull().sum()),
                "unique_values": int(df[col].nunique())
            }

        numeric_stats = {}
        num_df = df.select_dtypes(include=[np.number])
        if not num_df.empty:
            numeric_stats = num_df.describe().to_dict()

        categorical_summary = {}
        # إصلاح تحذير Pandas 4 الصريح
        cat_df = df.select_dtypes(include=['object', 'string', 'category'])
        for col in cat_df.columns:
            top_v = df[col].value_counts().head(15).to_dict()
            categorical_summary[col] = {str(k): int(v) for k, v in top_v.items()}

        result_data = {
            "sheets_available": sheet_names,
            "shape": {"rows": total_rows, "columns": total_cols},
            "columns_metadata": columns_meta,
            "numeric_statistics": numeric_stats,
            "categorical_summary": categorical_summary,
            "preview": df.head(50).fillna("").to_dict(orient="records")
        }
        reply_msg = f"📊 تم تحليل قوام البيانات بنجاح ({total_rows} صف × {total_cols} عمود)."

    elif mode == "transform":
        op = params.get('operation', 'none')
        if op == 'groupby':
            group_col = params.get('group_col')
            agg_col = params.get('agg_col')
            agg_func = params.get('agg_func', 'sum')
            if group_col and agg_col:
                res_df = df.groupby(group_col).agg({agg_col: agg_func}).reset_index()
                result_data = {"transformed_preview": res_df.head(50).fillna("").to_dict(orient="records")}
                reply_msg = f"✅ تم تجميع البيانات بناءً على الحقل '{group_col}'."
            else:
                result_data = {"preview": df.head(30).fillna("").to_dict(orient="records")}
                reply_msg = "⚠️ معاملات التجميع غير مكتملة، تم إرجاع المعاينة."
        else:
            result_data = {"preview": df.head(30).fillna("").to_dict(orient="records")}
            reply_msg = "✅ تم تنفيذ الاستعلام النصي بنجاح."

    print(json.dumps({"ok": True, "reply": reply_msg, "data": result_data}, ensure_ascii=False, default=str))

except Exception as e:
    print(json.dumps({"ok": False, "reply": "❌ فشل تحليل بيانات الملف.", "error": str(e)}, ensure_ascii=False))
`;

    const scriptPath = path.join(path.dirname(filePath), `master_${Date.now()}.py`);
    fs.writeFileSync(scriptPath, pythonScript, "utf8");

    const output = execSync(`python3 "${scriptPath}" "${filePath}" "${mode}" '${paramsJson.replace(/'/g, "\\'")}'`, { encoding: "utf-8" });
    if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath);

    const parsed = JSON.parse(output.trim());
    if (!parsed.ok) return normalizedError(parsed.reply, new Error(parsed.error));
    
    // إرجاع رد نصي بحت بدون أي ملفات تحميل
    return normalizedReply(parsed.reply, parsed.data);
  } catch (err) {
    return normalizedError("خطأ في تشغيل محرك القراءة والاستعلام.", err);
  }
}

/* ============================================================
   ⚡ المترجم التنفيذي الديناميكي المطلق (Dynamic Agentic Executor)
   ============================================================ */
function runPythonDynamicExecutor(filePath, params = {}) {
  try {
    const outPath = path.join(path.dirname(filePath), `modified_${Date.now()}.xlsx`);
    
    // كود افتراضي للتنسيق في حال لم يتم إرسال كود ديناميكي
    const defaultCode = `
for col_num in range(1, ws.max_column + 1):
    cell = ws.cell(row=1, column=col_num)
    cell.font = Font(name='Arial', size=11, bold=True, color='FFFFFF')
    cell.fill = PatternFill(start_color='1F4E78', end_color='1F4E78', fill_type='solid')
    cell.alignment = Alignment(horizontal='center', vertical='center')

for col in ws.columns:
    max_len = max(len(str(cell.value or '')) for cell in col)
    col_letter = get_column_letter(col[0].column)
    ws.column_dimensions[col_letter].width = max(max_len + 4, 12)
`;

    const dynamicCode = params.custom_python_code || defaultCode;

    const pythonScript = `
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.utils import get_column_letter
import pandas as pd
import numpy as np
import sys
import json
import warnings

warnings.filterwarnings('ignore')

try:
    file_path = sys.argv[1]
    out_path = sys.argv[2]
    
    wb = openpyxl.load_workbook(file_path)
    ws = wb.active

    # ==========================================
    # ⚡ التنفيذ المباشر لكود بايثون الديناميكي
    # ==========================================
${dynamicCode.split('\n').map(line => '    ' + line).join('\n')}
    # ==========================================

    wb.save(out_path)
    print(json.dumps({"ok": True, "reply": "🎨 تم تعديل وهندسة الملف بنجاح.", "file_created": True}, ensure_ascii=False))

except Exception as e:
    print(json.dumps({"ok": False, "reply": "❌ فشل التنفيذ البرمجي الديناميكي.", "error": str(e)}, ensure_ascii=False))
`;

    const scriptPath = path.join(path.dirname(filePath), `opx_agent_${Date.now()}.py`);
    fs.writeFileSync(scriptPath, pythonScript, "utf8");

    const output = execSync(`python3 "${scriptPath}" "${filePath}" "${outPath}"`, { encoding: "utf-8" });
    if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath);

    const parsedOutput = JSON.parse(output.trim());
    if (!parsedOutput.ok) return normalizedError(parsedOutput.reply, new Error(parsedOutput.error));

    // فقط عند التعديل الفعلي والنجاح، نعيد الملف كـ Base64
    if (fs.existsSync(outPath)) {
      const base64 = fs.readFileSync(outPath).toString("base64");
      return normalizedFile("تم تعديل الملف وهندسته بنجاح.", outPath, "modified_alatheer.xlsx", base64);
    }

    return normalizedReply(parsedOutput.reply, null);
  } catch (err) {
    return normalizedError("فشل تنفيذ المحرك الديناميكي.", err);
  }
}

/* ============================================================
   🟥 CONVERT – التحويل البرمجي
   ============================================================ */
function runPythonConvert(filePath, params) {
  try {
    const ext = params.format || "json";
    const outPath = path.join(path.dirname(filePath), `converted_${Date.now()}.${ext}`);

    const pythonScript = `
import pandas as pd
import sys
import warnings

warnings.filterwarnings('ignore')

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
    return normalizedFile(`تم التحويل إلى صيغة ${ext} بنجاح عبر Pandas.`, outPath, `converted.${ext}`, base64);
  } catch (err) {
    return normalizedError("فشل تحويل الملف.", err);
  }
}

/* ============================================================
   🟫 طبقة توحيد الردود السيادية
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

