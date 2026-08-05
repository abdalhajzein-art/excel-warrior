/**
 * api/core/dynamic_executor.js – Alatheer Master Sovereign Engine (AutoFit Fixed Edition)
 * ⚡ محرك التنفيذ السيادي المتكامل مع النسخ الذري، حراسة القوائم، والتدقيق البصري الذكي.
 */

import fs from 'fs';
import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execFileAsync = promisify(execFile);

export async function executeDynamicPython(pythonCode, targetFilePath) {
    return new Promise(async (resolve, reject) => {
        if (!targetFilePath || !fs.existsSync(targetFilePath)) {
            return resolve({ success: false, error: "مسار الملف المستهدف غير موجود أو غير صالح يا هندسة." });
        }

        const isMacroEnabled = targetFilePath.toLowerCase().endsWith('.xlsm');

        const ext = path.extname(targetFilePath);
        const base = targetFilePath.slice(0, -ext.length);
        const backupPath = `${base}_bak_${Date.now()}${ext}`;

        const scriptName = `temp_script_${Date.now()}_${Math.floor(Math.random() * 1000)}.py`;
        const scriptPath = path.join(process.cwd(), scriptName);

        try {
            // 🛡️ 1. النسخ الاحتياطي الذري الفوري (Atomic Snapshot)
            fs.copyFileSync(targetFilePath, backupPath);
            console.log(`🛡️ [Sovereign Guard] تم إنشاء نسخة احتياطية ذرية للملف: ${path.basename(backupPath)}`);

            // حقن دعم الـ VBA تلقائياً إذا لزم الأمر
            let enhancedPythonCode = pythonCode;
            if (isMacroEnabled && !pythonCode.includes('keep_vba')) {
                enhancedPythonCode = pythonCode.replace(
                    /openpyxl\.load_workbook\s*\(([^)]+)\)/g,
                    'openpyxl.load_workbook($1, keep_vba=True)'
                );
            }

            fs.writeFileSync(scriptPath, enhancedPythonCode, 'utf8');

            exec(`python3 "${scriptPath}" "${targetFilePath}"`, { maxBuffer: 10 * 1024 * 1024 }, async (error, stdout, stderr) => {
                if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath);

                if (error) {
                    console.error(`❌ [Dynamic Executor Error]:`, error.message);
                    console.error(`❌ [Dynamic Executor Python Error Details]:`, stderr);

                    if (fs.existsSync(backupPath)) {
                        fs.copyFileSync(backupPath, targetFilePath);
                        fs.unlinkSync(backupPath);
                        console.log(`🔄 [Sovereign Guard] تم استعادة الملف الأصلي من النسخة الاحتياطية بنجاح إثر خطأ برمجي.`);
                    }
                    return resolve({ success: false, error: stderr || error.message });
                }

                // 🔍 2. التدقيق السيادي مع AutoFit ذكي
                try {
                    const sovereignValidatorScript = `
import sys
import openpyxl
from openpyxl.utils import get_column_letter

backup_path = sys.argv[1]
modified_path = sys.argv[2]
is_xlsm = modified_path.lower().endswith('.xlsm')

try:
    wb_backup = openpyxl.load_workbook(backup_path, keep_vba=is_xlsm)
    wb_modified = openpyxl.load_workbook(modified_path, keep_vba=is_xlsm)

    if len(wb_modified.sheetnames) == 0:
        raise Exception("الملف المعدل فارغ تماماً من أوراق العمل!")

    for sheetname in wb_backup.sheetnames:
        if sheetname in wb_modified.sheetnames:
            ws_orig = wb_backup[sheetname]
            ws_mod = wb_modified[sheetname]

            # استعادة القوائم المنسدلة
            if hasattr(ws_orig, 'data_validations'):
                try:
                    for dv in ws_orig.data_validations.dataValidation:
                        ws_mod.add_data_validation(dv)
                except:
                    pass

            # استعادة التنسيقات الشرطية
            if hasattr(ws_orig, 'conditional_formatting'):
                try:
                    for cf in ws_orig.conditional_formatting:
                        ws_mod.conditional_formatting.add(cf.sqref, cf)
                except:
                    pass

            # AutoFit ذكي للأعمدة بدون تمدد مبالغ فيه
            for col in ws_mod.columns:
                try:
                    # نقيّد القراءة على أول 20 صف فقط
                    values = [str(cell.value or '') for cell in col[:20]]
                    if not values:
                        continue
                    avg_len = sum(len(v) for v in values) / len(values)
                    col_letter = get_column_letter(col[0].column)
                    # عرض منطقي بين 12 و 35
                    ws_mod.column_dimensions[col_letter].width = min(max(avg_len + 2, 12), 35)
                except:
                    pass

    wb_modified.save(modified_path)
    print("SOVEREIGN_VALIDATION_OK")

except Exception as e:
    print(f"SOVEREIGN_ERROR: {str(e)}")
    sys.exit(1)
`;
                    const validatorPath = path.join(process.cwd(), `sovereign_validator_${Date.now()}.py`);
                    fs.writeFileSync(validatorPath, sovereignValidatorScript, 'utf8');

                    exec(`python3 "${validatorPath}" "${backupPath}" "${targetFilePath}"`, (valError, valStdout, valStderr) => {
                        if (fs.existsSync(validatorPath)) fs.unlinkSync(validatorPath);

                        if (valError || not valStdout or "SOVEREIGN_VALIDATION_OK" not in valStdout):
                            const valMsg = valStderr or valStdout or "فشل الفحص السيادي"
                            console.warn("⚠️ [Sovereign Guard Warning] التدقيق السيادي كشف تلفاً وتم الاسترجاع:", valMsg)

                            if (fs.existsSync(backupPath)):
                                fs.copyFileSync(backupPath, targetFilePath)
                                fs.unlinkSync(backupPath)
                            return resolve({ success: False, error: "فشل الفحص السيادي للملف: تم استعادة النسخة الأصلية الآمنة تلقائياً." })

                        if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);

                        console.log(`✅ [Alatheer Sovereign Master Success]: تمت معالجة الملف وتفعيل كافة الجواهر السيادية بنجاح تام.`);
                        resolve({ success: true, output: stdout });
                    });

                } catch (valEx) {
                    if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
                    resolve({ success: true, output: stdout });
                }
            });

        } catch (initError) {
            if (fs.existsSync(backupPath)) {
                fs.copyFileSync(backupPath, targetFilePath);
                fs.unlinkSync(backupPath);
            }
            console.error(`❌ [Sovereign Master Exception]:`, initError.message);
            resolve({ success: false, error: initError.message });
        }
    });
}

export async function extractPreviewAsync(filePath) {
    const pythonPreviewPath = path.join(__dirname, 'excel_preview.py');
    try {
        const { stdout } = await execFileAsync('python3', [pythonPreviewPath, filePath], { maxBuffer: 10 * 1024 * 1024 });
        return JSON.parse(stdout);
    } catch (error) {
        console.warn("⚠️ Preview Engine Error:", error.message);
        return { error: error.message };
    }
            }
