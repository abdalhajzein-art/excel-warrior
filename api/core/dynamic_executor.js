/**
 * api/core/dynamic_executor.js – Sovereign Edition (Metadata Preprocessor)
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

        if (!pythonCode || pythonCode.trim().length < 10)
            return resolve({ success: false, error: "الكود قصير جداً وغير صالح." });

        const dir = path.dirname(targetFilePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const ext = path.extname(targetFilePath);
        const base = targetFilePath.slice(0, -ext.length);
        const backupPath = `${base}_bak_${Date.now()}${ext}`;

        const scriptName = `temp_script_${Date.now()}_${Math.floor(Math.random() * 1000)}.py`;
        const scriptPath = path.join(process.cwd(), scriptName);

        try {
            if (!isNewFile && fs.existsSync(targetFilePath)) {
                fs.copyFileSync(targetFilePath, backupPath);
            }

            // 🛠️ Metadata Preprocessor: حقن المكتبات ومتغير المسار قسرياً لمنع أخطاء NameError
            const safeCode = `
import sys
import os
import traceback
import pandas as pd
import openpyxl

# المتغير السيادي الموحد للمسار
target_file = r'''${targetFilePath}'''

# ============================================
# ⚡ بداية كود الأثير المُنفذ
# ============================================
${pythonCode}
# ============================================

print("SUCCESS: تم التنفيذ بنجاح ✓")
`;

            fs.writeFileSync(scriptPath, safeCode, "utf8");

            execFile(
                PYTHON_EXEC,
                [scriptPath],
                { maxBuffer: 50 * 1024 * 1024 },
                async (error, stdout, stderr) => {

                    try { fs.unlinkSync(scriptPath); } catch(e) {}

                    const outputStr = (stdout || "").toLowerCase();
                    const hasRuntimeError = error || stderr || outputStr.includes("error") || outputStr.includes("exception");

                    if (hasRuntimeError) {
                        if (!isNewFile && fs.existsSync(backupPath)) {
                            fs.copyFileSync(backupPath, targetFilePath);
                        }
                        if (fs.existsSync(backupPath)) {
                            try { fs.unlinkSync(backupPath); } catch(e) {}
                        }
                        return resolve({
                            success: false,
                            error: stderr || (error ? error.message : "خطأ غير معروف أثناء التنفيذ"),
                            output: stdout
                        });
                    }

                    if (!isNewFile && fs.existsSync(backupPath)) {
                        try { fs.unlinkSync(backupPath); } catch(e) {}
                    }

                    if (isNewFile && !fs.existsSync(targetFilePath)) {
                        return resolve({
                            success: false,
                            error: "لم يتم إنشاء الملف المطلوب. تأكد من استخدام المتغير target_file في الحفظ.",
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

