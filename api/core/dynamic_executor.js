/**
 * api/core/dynamic_executor.js – Sovereign Strict Edition
 * أقوى نسخة: تمنع الانزلاق، تمنع السكربتات المكسورة، تمنع البدء من الصفر،
 * وتربط التنفيذ بالسياق السيادي (currentFile / currentOperation / sessionMode).
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
   🛡️ 1) Sovereign Script Validator
   يفحص السكربت قبل التنفيذ ويمنع أي سكربت غير صالح
--------------------------------------------------------- */
function validateScriptStrict(pythonCode, isNewFile) {
    const errors = [];

    if (!pythonCode || pythonCode.trim().length < 10)
        errors.push("الكود قصير جداً وغير صالح.");

    const lines = pythonCode.split("\n").filter(l => l.trim().length > 0);
    if (lines.length < 5)
        errors.push("الكود يحتوي على أقل من 5 أسطر — سكربت غير صالح.");

    if (!pythonCode.includes("openpyxl"))
        errors.push("الكود لا يحتوي على import openpyxl — غير صالح.");

    if (!pythonCode.includes("wb.save"))
        errors.push("الكود لا يحتوي على wb.save — غير صالح.");

    if (!pythonCode.includes("load_workbook") && !isNewFile)
        errors.push("الكود لا يحتوي على load_workbook رغم أن العملية تعديل.");

    if (pythonCode.includes("Workbook()") && !isNewFile)
        errors.push("الكود ينشئ Workbook جديد رغم أن العملية تعديل — انزلاق سياقي.");

    if (pythonCode.includes("save(") && !pythonCode.includes("sys.argv[1]"))
        errors.push("الكود يحفظ الملف باسم ثابت وليس sys.argv[1] — غير مسموح.");

    return errors;
}

/* ---------------------------------------------------------
   🛡️ 2) Sovereign Drift Detector
   يكشف إذا النموذج بدأ من الصفر أو تجاهل الملف
--------------------------------------------------------- */
function detectDrift(pythonCode, targetFilePath, isNewFile) {
    if (!isNewFile && pythonCode.includes("Workbook()"))
        return "النموذج بدأ ملفاً جديداً رغم أن العملية تعديل.";

    if (!pythonCode.includes(path.basename(targetFilePath)) && !isNewFile)
        return "الكود لا يشير إلى الملف الحالي — انزلاق سياقي.";

    return null;
}

/* ---------------------------------------------------------
   ⚡ 3) التنفيذ الصارم
--------------------------------------------------------- */
export async function executeDynamicPython(pythonCode, targetFilePath, isNewFile = false, sessionId = null) {
    return new Promise((resolve) => {

        /* 🛡️ فحص المسار */
        if (!targetFilePath)
            return resolve({ success: false, error: "مسار الملف غير صالح." });

        /* 🛡️ فحص السكربت */
        const validationErrors = validateScriptStrict(pythonCode, isNewFile);
        if (validationErrors.length > 0) {
            return resolve({
                success: false,
                error: "❌ سكربت غير صالح:\n" + validationErrors.join("\n")
            });
        }

        /* 🛡️ كشف الانزلاق */
        const drift = detectDrift(pythonCode, targetFilePath, isNewFile);
        if (drift) {
            return resolve({
                success: false,
                error: `⚠️ انزلاق سياقي:\n${drift}`
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

            /* 🛡️ بناء سكربت آمن */
            const safeCode = `
import sys
import traceback
import os

if len(sys.argv) < 2:
    sys.argv.append('${targetFilePath}')

try:
    import openpyxl
    from openpyxl.utils import get_column_letter
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from openpyxl.styles.borders import BORDER_THIN
    from openpyxl.worksheet.datavalidation import DataValidation
    from openpyxl.formatting.rule import Rule
    from openpyxl.styles.differential import DifferentialStyle
    from openpyxl.chart import BarChart, PieChart, Reference
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "openpyxl"])
    import openpyxl

# دوال مساعدة
def write_formula(cell, formula_string):
    if formula_string.startswith('='):
        cell.value = formula_string
    else:
        cell.value = '=' + formula_string
    return cell

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

                    /* حذف السكربت */
                    try { fs.unlinkSync(scriptPath); } catch(e) {}

                    if (error) {
                        /* 🛡️ Rollback */
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

                    /* حذف النسخة الاحتياطية */
                    if (!isNewFile && fs.existsSync(backupPath)) {
                        fs.unlinkSync(backupPath);
                    }

                    /* 🛡️ تحقق من وجود الملف */
                    if (isNewFile && !fs.existsSync(targetFilePath)) {
                        return resolve({
                            success: false,
                            error: "لم يتم إنشاء الملف المطلوب.",
                            output: stdout
                        });
                    }

                    /* 🧠 تحديث السياق السيادي */
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
