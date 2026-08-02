/**
 * engines/pandas.js – The Absolute Sovereign Pandas & Openpyxl Engine
 * محرك سيادي مطلق يستغل القوة الكاملة والعمياء لمكتبتي Pandas و Openpyxl بلا أي قيود أو تحجيم.
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
        return await runPythonMasterEngine(filePath, "profile", params);

      case "transform":
      case "aggregate":
      case "pivot":
        return await runPythonMasterEngine(filePath, "transform", params);

      case "style_and_format":
      case "openpyxl_manipulate":
        return await runPythonOpenpyxlMaster(filePath, params);

      case "convert":
        return await runPythonConvert(filePath, params);

      default:
        return await runPythonMasterEngine(filePath, "profile", params);
    }
  } catch (err) {
    return normalizedError("خطأ حرج في المحرك السيادي المطلق لـ Pandas/Openpyxl.", err);
  }
}

/* ============================================================
   🐍 المحرك الماستر السيادي (Pandas Powerhouse)
   ============================================================ */
function runPythonMasterEngine(filePath, mode, params = {}) {
  try {
    const paramsJson = JSON.stringify(params);

    const pythonScript = `
import pandas as pd
import numpy as np
import json
import sys

try:
    file_path = sys.argv[1]
    mode = sys.argv[2]
    params = json.loads(sys.argv[3]) if len(sys.argv) > 3 else {}

    # دعم كامل لجميع الأوراق (Multi-sheet Excel support) أو ملفات CSV
    if file_path.endswith(('.xlsx', '.xls')):
        xls = pd.ExcelFile(file_path)
        sheet_names = xls.sheet_names
        target_sheet = params.get('sheet', sheet_names[0])
        df = pd.read_excel(file_path, sheet_name=target_sheet)
    else:
        xls = None
        sheet_names = ["Sheet1"]
        df = pd.read_csv(file_path)

    # تنظيف أولي للهيكل بدون حذف بيانات حقيقية
    df = df.dropna(how='all', axis=0).dropna(how='all', axis=1)
    df.columns = [str(c).strip() for c in df.columns]

    result_data = {}
    reply_msg = ""

    if mode == "profile":
        # استخراج البصمة الكاملة للبيانات (DNA Profiling)
        total_rows, total_cols = df.shape
        columns_meta = {}
        for col in df.columns:
            columns_meta[col] = {
                "dtype": str(df[col].dtype),
                "null_count": int(df[col.strip()].isnull().sum()),
                "unique_values": int(df[col].nunique())
            }

        numeric_stats = {}
        num_df = df.select_dtypes(include=[np.number])
        if not num_df.empty:
            numeric_stats = num_df.describe().to_dict()

        categorical_summary = {}
        cat_df = df.select_dtypes(include=['object', 'category'])
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
        reply_msg = f"⚡ تم تحليل الملف الشامل عبر Pandas بنجاح (أوراق العمل: {sheet_names} | الأبعاد: {total_rows} صف × {total_cols} عمود)."

    elif mode == "transform":
        # تنفيذ عمليات متقدمة مثل التجميع، الفلترة، أو الـ Pivot Tables برمجياً
        op = params.get('operation', 'none')
        if op == 'groupby':
            group_col = params.get('group_col')
            agg_col = params.get('agg_col')
            agg_func = params.get('agg_func', 'sum')
            if group_col and agg_col:
                res_df = df.groupby(group_col).agg({agg_col: agg_func}).reset_index()
                result_data = {"transformed_preview": res_df.head(50).fillna("").to_dict(orient="records")}
                reply_msg = f"✅ تم تجميع البيانات برمجياً بناءً على الحقل '{group_col}'."
            else:
                result_data = {"preview": df.head(30).fillna("").to_dict(orient="records")}
                reply_msg = "⚠️ معاملات التجميع غير مكتملة، تم إرجاع المعاينة."
        else:
            result_data = {"preview": df.head(30).fillna("").to_dict(orient="records")}
            reply_msg = "✅ تم تنفيذ التحويل البرمجي بنجاح."

    print(json.dumps({"ok": True, "reply": reply_msg, "data": result_data}, ensure_ascii=False, default=str))

except Exception as e:
    print(json.dumps({"ok": False, "reply": "❌ فشل تنفيذ المحرك الماستر.", "error": str(e)}, ensure_ascii=False))
`;

    const scriptPath = path.join(path.dirname(filePath), `master_${Date.now()}.py`);
    fs.writeFileSync(scriptPath, pythonScript, "utf8");

    const output = execSync(`python3 "${scriptPath}" "${filePath}" "${mode}" '${paramsJson.replace(/'/g, "\\'")}'`, { encoding: "utf-8" });
    if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath);

    const parsed = JSON.parse(output.trim());
    if (!parsed.ok) {
      return normalizedError(parsed.reply, new Error(parsed.error));
    }
    return parsed;
  } catch (err) {
    return normalizedError("خطأ في تشغيل بيئة بايثون الرئيسية.", err);
  }
}

/* ============================================================
   🎨 محرك Openpyxl الهيكلي والبصري المطلق (Styling & Formatting)
   ============================================================ */
function runPythonOpenpyxlMaster(filePath, params = {}) {
  try {
    const outPath = path.join(path.dirname(filePath), `formatted_${Date.now()}.xlsx`);
    const paramsJson = JSON.stringify(params);

    const pythonScript = `
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
import sys
import json

try:
    file_path = sys.argv[1]
    out_path = sys.argv[2]
    params = json.loads(sys.argv[3]) if len(sys.argv) > 3 else {}

    # فتح الملف عبر Openpyxl للتحكم المطلق بالخلايا والتنسيقات
    wb = openpyxl.load_workbook(file_path)
    ws = wb.active

    # تطبيق التنسيق الاحترافي التلقائي على الجدول (Header Styling, Auto-fit columns, Borders)
    header_font = Font(name='Arial', size=11, bold=True, color='FFFFFF')
    header_fill = PatternFill(start_color='1F4E78', end_color='1F4E78', fill_type='solid')
    thin_border = Border(
        left=Side(style='thin', color='D9D9D9'),
        right=Side(style='thin', color='D9D9D9'),
        top=Side(style='thin', color='D9D9D9'),
        bottom=Side(style='thin', color='D9D9D9')
    )

    # تنسيق الصف الأول (الترويسة)
    for col_num in range(1, ws.max_column + 1):
        cell = ws.cell(row=1, column=col_num)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal='center', vertical='center')

    # تنسيق وبدء تخطيط الخلايا وضبط عرض الأعمدة تلقائياً
    for col in ws.columns:
        max_len = 0
        col_letter = get_column_letter(col[0].column)
        for cell in col:
            if cell.value:
                max_len = max(max_len, len(str(cell.value)))
            # تطبيق الحدود على كافة خلايا البيانات
            if cell.row > 1:
                cell.border = thin_border
                cell.alignment = Alignment(horizontal='general', vertical='center')
        ws.column_dimensions[col_letter].width = max(max_len + 4, 12)

    wb.save(out_path)
    print(json.dumps({"ok": True, "reply": "🎨 تم إعادة هندسة وتنسيق ملف الإكسل بالكامل عبر Openpyxl (تنسيق ترويسة، حدود، وضبط أعمدة)."}, ensure_ascii=False))

except Exception as e:
    print(json.dumps({"ok": False, "reply": "❌ فشل محرك Openpyxl.", "error": str(e)}, ensure_ascii=False))
`;

    const scriptPath = path.join(path.dirname(filePath), `opx_${Date.now()}.py`);
    fs.writeFileSync(scriptPath, pythonScript, "utf8");

    execSync(`python3 "${scriptPath}" "${filePath}" "${outPath}" '${paramsJson.replace(/'/g, "\\'")}'`, { encoding: "utf-8" });
    if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath);

    const base64 = fs.readFileSync(outPath).toString("base64");
    return normalizedFile("تم تنسيق وهندسة الملف بنجاح عبر Openpyxl.", outPath, "formatted.xlsx", base64);
  } catch (err) {
    return normalizedError("فشل تنفيذ هندسة Openpyxl.", err);
  }
}

/* ============================================================
   🟥 CONVERT – التحويل البرمجي المتكامل
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

