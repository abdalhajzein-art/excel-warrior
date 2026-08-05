/**
 * api/core/dynamic_executor.js – Sovereign Minimal Edition (Optimized & Dual-Mode Ready)
 * ⚡ تنفيذ سكربت بايثون مع دعم التعديل والتوليد
 * ✅ إصلاح مشكلة المعادلات (Formulas) - كتابتها كصيغ وليس كنصوص
 * ✅ إزالة استيراد Formula غير الموجود في openpyxl 3.1.5
 */

import fs from "fs";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execFileAsync = promisify(execFile);

export async function executeDynamicPython(pythonCode, targetFilePath, isNewFile = false) {
    return new Promise((resolve) => {
        if (!targetFilePath) {
            return resolve({ success: false, error: "مسار الملف غير صالح." });
        }

        // ✅ التحقق من صحة الكود
        if (!pythonCode || pythonCode.trim().length === 0) {
            return resolve({ success: false, error: "لا يوجد كود بايثون للتنفيذ." });
        }

        // ✅ التأكد من وجود المجلد
        const dir = path.dirname(targetFilePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        if (!isNewFile && !fs.existsSync(targetFilePath)) {
            return resolve({ success: false, error: "مسار الملف المراد تعديله غير موجود." });
        }

        const ext = path.extname(targetFilePath);
        const base = targetFilePath.slice(0, -ext.length);
        const backupPath = `${base}_bak_${Date.now()}${ext}`;

        const scriptName = `temp_script_${Date.now()}_${Math.floor(Math.random() * 1000)}.py`;
        const scriptPath = path.join(process.cwd(), scriptName);

        try {
            // 1. نسخة احتياطية
            if (!isNewFile && fs.existsSync(targetFilePath)) {
                fs.copyFileSync(targetFilePath, backupPath);
            }

            // ✅ تعديل الكود: نضمن أن sys.argv[1] موجود دائماً
            // ✅ إضافة استيرادات مهمة (بدون Formula)
            // ✅ إصلاح كتابة المعادلات كصيغ
            const safeCode = `
import sys
import traceback
import os

# ✅ التأكد من وجود المسار في argv
if len(sys.argv) < 2:
    sys.argv.append('${targetFilePath}')

# ✅ استيراد المكتبات (بدون Formula)
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
    from openpyxl.utils import get_column_letter
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from openpyxl.styles.borders import BORDER_THIN
    from openpyxl.worksheet.datavalidation import DataValidation
    from openpyxl.formatting.rule import Rule
    from openpyxl.styles.differential import DifferentialStyle
    from openpyxl.chart import BarChart, PieChart, Reference

# ✅ دالة مساعدة لكتابة المعادلات (بدون Formula)
def write_formula(cell, formula_string):
    """
    كتابة المعادلة كصيغة في Excel
    openpyxl يتعامل مع أي قيمة تبدأ بـ = كصيغة تلقائياً
    """
    cell.value = formula_string
    return cell

# ✅ دالة مساعدة لإضافة تنسيق شرطي بسهولة
def add_conditional_formatting(ws, cell_range, formula, style):
    """إضافة تنسيق شرطي بسيط"""
    from openpyxl.formatting.rule import Rule
    from openpyxl.styles.differential import DifferentialStyle
    from openpyxl.styles import PatternFill
    
    diff_style = DifferentialStyle()
    if style.get('fill'):
        diff_style.fill = PatternFill(start_color=style['fill'], end_color=style['fill'], fill_type="solid")
    if style.get('font_color'):
        diff_style.font = Font(color=style['font_color'])
    
    rule = Rule(type="expression", formula=[formula], dxf=diff_style)
    ws.conditional_formatting.add(cell_range, rule)
    return rule

try:
    # ✅ تنفيذ الكود الأصلي
${pythonCode.split('\n').map(line => '    ' + line).join('\n')}
    
    # ✅ إذا وصلنا لهنا يعني نجحنا
    print("SUCCESS: تم التنفيذ بنجاح ✓")

except Exception as e:
    # ✅ طباعة الخطأ بشكل واضح
    print(f"ERROR: {str(e)}")
    print(traceback.format_exc())
    sys.exit(1)
`;

            fs.writeFileSync(scriptPath, safeCode, "utf8");

            console.log(`🔧 تنفيذ سكربت: ${scriptPath}`);
            console.log(`📁 الملف المستهدف: ${targetFilePath}`);

            // 3. التنفيذ
            execFile(
                "python3", 
                [scriptPath, targetFilePath], 
                { maxBuffer: 50 * 1024 * 1024 },
                (error, stdout, stderr) => {
                    // ✅ تنظيف الملف المؤقت
                    if (fs.existsSync(scriptPath)) {
                        try { fs.unlinkSync(scriptPath); } catch(e) {}
                    }

                    // ✅ طباعة المخرجات للتصحيح
                    console.log("📤 stdout:", stdout);
                    if (stderr) console.log("⚠️ stderr:", stderr);

                    if (error) {
                        console.error("❌ Python Error:", stderr || error.message);

                        // ✅ استرجاع النسخة الاحتياطية
                        if (!isNewFile && fs.existsSync(backupPath)) {
                            fs.copyFileSync(backupPath, targetFilePath);
                            try { fs.unlinkSync(backupPath); } catch(e) {}
                        } else if (isNewFile && fs.existsSync(targetFilePath)) {
                            try { fs.unlinkSync(targetFilePath); } catch(e) {}
                        }

                        return resolve({ 
                            success: false, 
                            error: stderr || error.message,
                            output: stdout 
                        });
                    }

                    // ✅ تنظيف النسخة الاحتياطية
                    if (!isNewFile && fs.existsSync(backupPath)) {
                        try { fs.unlinkSync(backupPath); } catch(e) {}
                    }

                    // ✅ التحقق من وجود الملف الناتج
                    if (isNewFile && !fs.existsSync(targetFilePath)) {
                        return resolve({ 
                            success: false, 
                            error: "لم يتم إنشاء الملف المطلوب",
                            output: stdout 
                        });
                    }

                    return resolve({ 
                        success: true, 
                        output: stdout,
                        filePath: targetFilePath 
                    });
                }
            );
        } catch (err) {
            console.error("❌ Executor Exception:", err.message);

            if (fs.existsSync(scriptPath)) {
                try { fs.unlinkSync(scriptPath); } catch(e) {}
            }
            if (!isNewFile && fs.existsSync(backupPath)) {
                try {
                    fs.copyFileSync(backupPath, targetFilePath);
                    fs.unlinkSync(backupPath);
                } catch(e) {}
            }

            return resolve({ success: false, error: err.message });
        }
    });
}

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
        console.warn("⚠️ Preview Error:", error.message);
        return { error: error.message };
    }
                            }
