/**
 * api/core/dynamic_executor.js – Sovereign Edition (Unleashed Agentic Flow)
 * 🚀 مُحسن ليعطي Gemini الصلاحية المطلقة لاستخدام pandas و openpyxl النقي
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

// ✅ التوجيه الذكي لمسار بايثون: استخدام البيئة الافتراضية في وضع الإنتاج
const PYTHON_EXEC = process.env.NODE_ENV === "production" ? "/opt/venv/bin/python" : "python3";

/* ---------------------------------------------------------
   ⚡ التنفيذ الديناميكي النقي
--------------------------------------------------------- */
export async function executeDynamicPython(pythonCode, targetFilePath, isNewFile = false, sessionId = null) {
    return new Promise((resolve) => {

        /* 🛡️ فحص المسار */
        if (!targetFilePath)
            return resolve({ success: false, error: "مسار الملف غير صالح." });

        if (!pythonCode || pythonCode.trim().length < 10)
            return resolve({ success: false, error: "الكود قصير جداً وغير صالح." });

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

            // ✅ تبسيط الكود وحقن الاستيرادات لمعالجة (NameError)
            const safeCode = `
import sys
import os
import traceback
import pandas as pd
import openpyxl

# حقن قسري في حال استمر النموذج في استدعاء دوال مخصصة قديمة لتجنب تعطل التنفيذ
try:
    from excel_agent_tools import xls_create_workbook
except ImportError:
    pass # في حال كنت تعتمد على openpyxl النقي ولم يعد هذا الملف موجوداً

# المسار المستهدف المحقون من بيئة Node.js (كمتغير ثابت لمنع أخطاء المتغيرات)
target_file = r'''${targetFilePath}'''

# ============================================
# ⚡ بداية كود الأثير (Gemini)
# ============================================
${pythonCode}
# ============================================

print("SUCCESS: تم التنفيذ بنجاح ✓")
`;

            fs.writeFileSync(scriptPath, safeCode, "utf8");

            /* ⚡ تنفيذ باستخدام مسار الـ venv الصحيح مع تمرير المسار لـ sys.argv */
            execFile(
                PYTHON_EXEC,
                [scriptPath, targetFilePath], // ✅ الحل لمشكلة (IndexError): تمرير المسار كمتغير سطر أوامر
                { maxBuffer: 50 * 1024 * 1024 },
                async (error, stdout, stderr) => {

                    try { fs.unlinkSync(scriptPath); } catch(e) {}

                    // التقاط أخطاء بايثون الحقيقية وإعادتها للنموذج ليتعلم منها
                    if (error || stderr) {
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
                            error: "لم يتم إنشاء الملف المطلوب. تأكد من أن السكربت يحفظ الملف في المتغير target_file",
                            output: stdout
                        });
                    }

                    // تحديث ذاكرة الجلسة
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
        const { stdout, stderr } = await execFileAsync(PYTHON_EXEC, [pythonPreviewPath, filePath], {
            maxBuffer: 10 * 1024 * 1024
        });
        
        if (stderr) console.warn("⚠️ [Preview Error]:", stderr);

        const jsonMatch = stdout.match(/\{[\s\S]*\}/);
        const cleanStdout = jsonMatch ? jsonMatch[0] : stdout;

        return JSON.parse(cleanStdout);
    } catch (error) {
        return { error: error.message };
    }
}

