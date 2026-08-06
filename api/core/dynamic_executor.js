/**
 * api/core/dynamic_executor.js – Sovereign Edition (Excel-Agent-Tools Only)
 * 🚀 يدعم فقط excel-agent-tools، يرفض أي كود openpyxl خام
 */

import fs from "fs";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fusionMemory from "./fusion_memory.js";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execFileAsync = promisify(execFile);

/* ---------------------------------------------------------
   🛡️ 1) Sovereign Script Validator (Excel-Agent-Only)
--------------------------------------------------------- */
function validateScriptStrict(pythonCode, isNewFile) {
    const errors = [];

    if (!pythonCode || pythonCode.trim().length < 10)
        errors.push("الكود قصير جداً وغير صالح.");

    const lines = pythonCode.split("\n").filter(l => l.trim().length > 0);
    if (lines.length < 3)
        errors.push("الكود يحتوي على أقل من 3 أسطر — سكربت غير صالح.");

    // ❌ رفض أي كود يستخدم openpyxl مباشرة
    if (pythonCode.includes("openpyxl") && !pythonCode.includes("excel_agent")) {
        errors.push("🚫 استخدام openpyxl مباشرة غير مسموح. استخدم excel-agent-tools بدلاً من ذلك.");
    }

    // ✅ التعديل هنا: السماح بـ xls_ أو xls- 
    if (!pythonCode.includes("excel_agent") && !pythonCode.includes("xls_") && !pythonCode.includes("xls-")) {
        errors.push("الكود لا يستخدم excel-agent-tools — غير مسموح.");
    }

    // ✅ يجب أن يحتوي على واحدة من دوال الكتابة
    const hasWriteTool = pythonCode.includes("xls_write_range") || 
                         pythonCode.includes("xls-write-range") ||
                         pythonCode.includes("xls_create_workbook") ||
                         pythonCode.includes("xls-clone-workbook");
    
    if (isNewFile && !hasWriteTool) {
        errors.push("الملف جديد ولكن لا يوجد أداة كتابة (xls_write_range أو xls_create_workbook).");
    }

    return errors;
}

/* ---------------------------------------------------------
   ⚡ 2) التنفيذ
--------------------------------------------------------- */
export async function executeDynamicPython(pythonCode, targetFilePath, isNewFile = false, sessionId = null) {
    return new Promise((resolve) => {

        /* 🛡️ فحص المسار */
        if (!targetFilePath)
            return resolve({ success: false, error: "مسار الملف غير صالح." });

        /* 🛡️ فحص السكربت - صارم فقط للطريقة الجديدة */
        const validationErrors = validateScriptStrict(pythonCode, isNewFile);
        if (validationErrors.length > 0) {
            return resolve({
                success: false,
                error: "❌ سكربت غير صالح:\n" + validationErrors.join("\n")
            });
        }

        /* 🛡️ تأكد من وجود المجلد */
        const dir = path.dirname(targetFilePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        /* 🛡️ نسخة احتياطية */
        const ext = path.extname(targetFilePath);
        const base = targetFilePath.slice(0, -ext.length);
        const backupPath = `${base}_bak_${Date.now()}${ext}`;

        const scriptName = `temp_script_${Date.now()}_${Math.floor(Math.random() * 1000)}.py`;
        const scriptPath = path.join(process.cwd(), scriptName);

        try {
            if (!isNewFile && fs.existsSync(targetFilePath)) {
                fs.copyFileSync(targetFilePath, backupPath);
            }

            /* 🛡️ سكربت نظيف - فقط excel-agent-tools */
            const safeCode = `
import sys
import json
import subprocess
import traceback

if len(sys.argv) < 2:
    sys.argv.append('${targetFilePath}')

# ✅ دوال excel-agent-tools الجاهزة
def run_xls_tool(tool_name, **kwargs):
    """تشغيل أداة من excel-agent-tools"""
    cmd = [tool_name]
    for key, value in kwargs.items():
        if value is not None:
            cmd.append(f"--{key.replace('_', '-')}")
            cmd.append(str(value))
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise Exception(f"Tool {tool_name} failed: {result.stderr}")
    try:
        return json.loads(result.stdout)
    except:
        return {"output": result.stdout, "error": result.stderr}

# ============================================
# 📚 أدوات الكتابة
# ============================================

def xls_create_workbook(output_path, template=None):
    """إنشاء ملف Excel جديد"""
    cmd = ["xls-create-workbook", "--output", output_path]
    if template:
        cmd.extend(["--template", template])
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise Exception(f"xls-create-workbook failed: {result.stderr}")
    return json.loads(result.stdout) if result.stdout else {"status": "success"}

def xls_write_range(file_path, sheet_name, cell_range, data):
    """كتابة بيانات في نطاق"""
    data_json = json.dumps(data)
    return run_xls_tool("xls-write-range",
        input=file_path,
        output=file_path,
        sheet=sheet_name,
        range=cell_range,
        values=data_json)

def xls_clone_workbook(input_path, output_dir="./work"):
    """نسخ الملف للعمل عليه بأمان"""
    return run_xls_tool("xls-clone-workbook",
        input=input_path,
        output_dir=output_dir)

# ============================================
# 📖 أدوات القراءة
# ============================================

def xls_read_range(file_path, sheet_name, cell_range):
    """قراءة نطاق من الخلايا"""
    return run_xls_tool("xls-read-range",
        input=file_path,
        sheet=sheet_name,
        range=cell_range)

def xls_get_sheet_names(file_path):
    """الحصول على أسماء الأوراق"""
    return run_xls_tool("xls-get-sheet-names", input=file_path)

def xls_get_formulas(file_path, sheet_name):
    """استخراج المعادلات من ورقة"""
    return run_xls_tool("xls-get-formulas",
        input=file_path,
        sheet=sheet_name)

# ============================================
# 🏗️ أدوات الهيكل
# ============================================

def xls_add_sheet(file_path, sheet_name, token=None):
    """إضافة ورقة جديدة"""
    kwargs = {"input": file_path, "name": sheet_name}
    if token:
        kwargs["token"] = token
    return run_xls_tool("xls-add-sheet", **kwargs)

def xls_delete_sheet(file_path, sheet_name, token):
    """حذف ورقة (يتطلب توكن)"""
    return run_xls_tool("xls-delete-sheet",
        input=file_path,
        name=sheet_name,
        token=token)

def xls_insert_row(file_path, row_index, token=None):
    """إدراج صف"""
    kwargs = {"input": file_path, "row": str(row_index)}
    if token:
        kwargs["token"] = token
    return run_xls_tool("xls-insert-row", **kwargs)

def xls_insert_column(file_path, col_index, token=None):
    """إدراج عمود"""
    kwargs = {"input": file_path, "column": str(col_index)}
    if token:
        kwargs["token"] = token
    return run_xls_tool("xls-insert-column", **kwargs)

# ============================================
# 🧮 أدوات المعادلات
# ============================================

def xls_set_formula(file_path, sheet_name, cell, formula):
    """كتابة معادلة في خلية"""
    return run_xls_tool("xls-set-formula",
        input=file_path,
        sheet=sheet_name,
        cell=cell,
        formula=formula)

def xls_recalculate(file_path):
    """إعادة حساب جميع المعادلات"""
    return run_xls_tool("xls-recalculate", input=file_path)

# ============================================
# 📊 أدوات الكائنات
# ============================================

def xls_add_chart(file_path, sheet_name, chart_type, data_range, title):
    """إضافة رسم بياني"""
    return run_xls_tool("xls-add-chart",
        input=file_path,
        sheet=sheet_name,
        type=chart_type,
        range=data_range,
        title=title)

def xls_add_table(file_path, sheet_name, data_range, table_name):
    """إضافة جدول"""
    return run_xls_tool("xls-add-table",
        input=file_path,
        sheet=sheet_name,
        range=data_range,
        name=table_name)

# ============================================
# 🎨 أدوات التنسيق
# ============================================

def xls_format_range(file_path, sheet_name, cell_range, style):
    """تنسيق نطاق من الخلايا"""
    style_json = json.dumps(style)
    return run_xls_tool("xls-format-range",
        input=file_path,
        sheet=sheet_name,
        range=cell_range,
        style=style_json)

def xls_add_conditional_format(file_path, sheet_name, cell_range, condition, style):
    """إضافة تنسيق شرطي"""
    style_json = json.dumps(style)
    return run_xls_tool("xls-add-conditional-format",
        input=file_path,
        sheet=sheet_name,
        range=cell_range,
        condition=condition,
        style=style_json)

# ============================================
# 🔐 أدوات الحوكمة
# ============================================

def xls_validate_workbook(file_path):
    """التحقق من سلامة الملف"""
    return run_xls_tool("xls-validate-workbook", input=file_path)

def xls_approve_token(file_path, scope, ttl=300):
    """توليد توكن للموافقة على العمليات"""
    return run_xls_tool("xls-approve-token",
        input=file_path,
        scope=scope,
        ttl=str(ttl))

# ============================================
# 📤 أدوات التصدير
# ============================================

def xls_export_pdf(file_path, output_path):
    """تصدير إلى PDF"""
    return run_xls_tool("xls-export-pdf",
        input=file_path,
        output=output_path)

def xls_export_csv(file_path, output_path):
    """تصدير إلى CSV"""
    return run_xls_tool("xls-export-csv",
        input=file_path,
        output=output_path)

# ============================================
# ⚡ تنفيذ الكود المطلوب
# ============================================

try:
${pythonCode.split('\n').map(line => '    ' + line).join('\n')}
    print("SUCCESS: تم التنفيذ بنجاح ✓")
except Exception as e:
    print(f"ERROR: {str(e)}")
    print(traceback.format_exc())
    sys.exit(1)
`;

            fs.writeFileSync(scriptPath, safeCode, "utf8");

            /* ⚡ تنفيذ */
            execFile(
                "python3",
                [scriptPath, targetFilePath],
                { maxBuffer: 50 * 1024 * 1024 },
                async (error, stdout, stderr) => {

                    try { fs.unlinkSync(scriptPath); } catch(e) {}

                    if (error) {
                        if (!isNewFile && fs.existsSync(backupPath)) {
                            fs.copyFileSync(backupPath, targetFilePath);
                            fs.unlinkSync(backupPath);
                        }
                        return resolve({
                            success: false,
                            error: stderr || error.message,
                            output: stdout
                        });
                    }

                    if (!isNewFile && fs.existsSync(backupPath)) {
                        fs.unlinkSync(backupPath);
                    }

                    if (isNewFile && !fs.existsSync(targetFilePath)) {
                        return resolve({
                            success: false,
                            error: "لم يتم إنشاء الملف المطلوب.",
                            output: stdout
                        });
                    }

                    if (sessionId) {
                        fusionMemory.storeCurrentFile(sessionId, targetFilePath);
                        fusionMemory.storeOperation(sessionId, isNewFile ? "generate_file" : "modify_file");
                        fusionMemory.storeSessionMode(sessionId, "file_edit");
                    }

                    return resolve({
                        success: true,
                        output: stdout,
                        filePath: targetFilePath
                    });
                }
            );

        } catch (err) {
            return resolve({ success: false, error: err.message });
        }
    });
}

/* ---------------------------------------------------------
   📊 استخراج المعاينة
--------------------------------------------------------- */
export async function extractPreviewAsync(filePath) {
    const pythonPreviewPath = path.join(__dirname, "excel_preview.py");
    try {
        const { stdout } = await execFileAsync("python3", [pythonPreviewPath, filePath], {
            maxBuffer: 10 * 1024 * 1024
        });

        const jsonMatch = stdout.match(/\{[\s\S]*\}/);
        const cleanStdout = jsonMatch ? jsonMatch[0] : stdout;

        return JSON.parse(cleanStdout);
    } catch (error) {
        return { error: error.message };
    }
}

