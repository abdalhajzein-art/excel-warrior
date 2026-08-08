/**
 * api/core/dynamic_executor.js – Sovereign Edition (Metadata Preprocessor & Quality Inspector)
 * 🛡️ نسخة محسنة: تمرير المسار الديناميكي، وإحباط الفشل الصامت.
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

const PYTHON_EXEC = process.env.NODE_ENV === "production" ? "/opt/venv/bin/python" : "python3";

export async function executeDynamicPython(pythonCode, targetFilePath, isNewFile = false, sessionId = null) {
    return new Promise((resolve) => {

        if (!targetFilePath)
            return resolve({ success: false, error: "مسار الملف غير صالح." });

        // 🔥 إحباط الفشل الصامت بقوة: إذا كان الكود فارغاً، توقف وبلّغ النظام!
        if (!pythonCode || typeof pythonCode !== 'string' || pythonCode.trim().length < 10) {
            console.error("❌ [Executor Error]: الكود المستلم فارغ أو قصير جداً. (فشل صامت محبط)");
            return resolve({ success: false, error: "فشل استخراج كود البايثون من النموذج، أو أن الكود غير صالح للتنفيذ." });
        }

        const dir = path.dirname(targetFilePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const ext = path.extname(targetFilePath);
        const base = targetFilePath.slice(0, -ext.length);
        const backupPath = `${base}_bak_${Date.now()}_${Math.floor(Math.random() * 10000)}${ext}`;

        const scriptName = `temp_script_${Date.now()}_${Math.floor(Math.random() * 10000)}.py`;
        const scriptPath = path.join(process.cwd(), scriptName);

        try {
            if (!isNewFile && fs.existsSync(targetFilePath)) {
                fs.copyFileSync(targetFilePath, backupPath);
            }

            // 🛠️ Metadata Preprocessor & Quality Inspector
            const safeCode = `
import sys
import os
import traceback
import pandas as pd
import openpyxl

# 🛡️ المتغير السيادي الموحد للمسار
if len(sys.argv) > 1:
    target_file = sys.argv[1]
else:
    print("ERROR: لم يتم تمرير مسار الملف للسكربت.")
    sys.exit(1)

# ============================================
# ⚡ بداية كود الأثير المُنفذ (مُولد من النموذج)
# ============================================
${pythonCode}
# ============================================

# --- 🔍 المفتش البرمجي التلقائي للجودة (Self-Inspection) ---
if target_file.endswith('.xlsx') and os.path.exists(target_file):
    try:
        wb_check = openpyxl.load_workbook(target_file)
        validations_count = 0
        cf_count = 0
        for ws in wb_check.worksheets:
            if ws.data_validations and ws.data_validations.dataValidation:
                validations_count += len(ws.data_validations.dataValidation)
            if ws.conditional_formatting:
                for cf in ws.conditional_formatting:
                    cf_count += len(ws.conditional_formatting[cf])
        
        print(f"\\n--- [Quality Report] ---")
        print(f"Data Validations: {validations_count}")
        print(f"Conditional Formatting Rules: {cf_count}")
    except Exception as e:
        print(f"\\n--- [Quality Report Error]: {e} ---")

# علامة النجاح السيادية الصارمة
print("SUCCESS: تم التنفيذ بنجاح ✓")
`;

            fs.writeFileSync(scriptPath, safeCode, "utf8");

            execFile(
                PYTHON_EXEC,
                [scriptPath, targetFilePath], 
                { maxBuffer: 50 * 1024 * 1024 },
                async (error, stdout, stderr) => {

                    try { fs.unlinkSync(scriptPath); } catch(e) {}

                    const outputStr = (stdout || "");
                    const hasSuccessMark = outputStr.includes("SUCCESS: تم التنفيذ بنجاح ✓");
                    const fileExistsAndValid = fs.existsSync(targetFilePath) && fs.statSync(targetFilePath).size > 0;

                    const hasRuntimeError = error || !hasSuccessMark || !fileExistsAndValid;

                    if (hasRuntimeError) {
                        if (!isNewFile && fs.existsSync(backupPath)) {
                            try { fs.copyFileSync(backupPath, targetFilePath); } catch(e) {}
                        }
                        if (fs.existsSync(backupPath)) {
                            try { fs.unlinkSync(backupPath); } catch(e) {}
                        }

                        const failureReason = stderr || (error ? error.message : null) || (!hasSuccessMark ? "فشل السكربت في الوصول لعلامة النجاح النهائية (ممكن في مشكلة بالحفظ)" : "الملف النتج مفقود أو فارغ");

                        return resolve({
                            success: false,
                            error: failureReason,
                            output: stdout
                        });
                    }

                    if (!isNewFile && fs.existsSync(backupPath)) {
                        try { fs.unlinkSync(backupPath); } catch(e) {}
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
            if (fs.existsSync(backupPath)) {
                try { fs.copyFileSync(backupPath, targetFilePath); fs.unlinkSync(backupPath); } catch(e) {}
            }
            return resolve({ success: false, error: err.message });
        }
    });
}

export async function extractPreviewAsync(filePath) {
    const pythonPreviewPath = path.join(__dirname, "excel_preview.py");
    try {
        const { stdout, stderr } = await execFileAsync(PYTHON_EXEC, [pythonPreviewPath, filePath], {
            maxBuffer: 10 * 1024 * 1024
        });
        
        if (stderr) console.warn("⚠️ [Preview Error]:", stderr);
        const jsonMatch = stdout.match(/\{[\s\S]*\}/);
        return JSON.parse(jsonMatch ? jsonMatch[0] : stdout);
    } catch (error) {
        return { error: error.message };
    }
}

