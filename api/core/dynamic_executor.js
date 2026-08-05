/**
 * api/core/dynamic_executor.js – Sovereign Minimal Edition
 * ⚡ محرك تنفيذ بسيط ومستقر بدون أي إصلاحات بصرية أو AutoFit أو حقن تنسيقات.
 */

import fs from 'fs';
import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function executeDynamicPython(pythonCode, targetFilePath) {
    return new Promise(async (resolve) => {
        if (!targetFilePath || !fs.existsSync(targetFilePath)) {
            return resolve({ success: false, error: "مسار الملف غير موجود." });
        }

        const ext = path.extname(targetFilePath);
        const base = targetFilePath.slice(0, -ext.length);
        const backupPath = `${base}_bak_${Date.now()}${ext}`;

        const scriptName = `temp_script_${Date.now()}_${Math.floor(Math.random() * 1000)}.py`;
        const scriptPath = path.join(process.cwd(), scriptName);

        try {
            // 🛡️ نسخ احتياطي بسيط
            fs.copyFileSync(targetFilePath, backupPath);

            // كتابة سكربت بايثون
            fs.writeFileSync(scriptPath, pythonCode, 'utf8');

            // تنفيذ بايثون
            exec(`python3 "${scriptPath}" "${targetFilePath}"`, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
                // حذف السكربت المؤقت
                if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath);

                if (error) {
                    console.error("❌ Python Error:", stderr || error.message);

                    // 🔄 استعادة النسخة الأصلية
                    if (fs.existsSync(backupPath)) {
                        fs.copyFileSync(backupPath, targetFilePath);
                        fs.unlinkSync(backupPath);
                    }

                    return resolve({ success: false, error: stderr || error.message });
                }

                // حذف النسخة الاحتياطية بعد نجاح التنفيذ
                if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);

                return resolve({ success: true, output: stdout });
            });

        } catch (err) {
            console.error("❌ Executor Exception:", err.message);

            if (fs.existsSync(backupPath)) {
                fs.copyFileSync(backupPath, targetFilePath);
                fs.unlinkSync(backupPath);
            }

            return resolve({ success: false, error: err.message });
        }
    });
}

export async function extractPreviewAsync(filePath) {
    const pythonPreviewPath = path.join(__dirname, 'excel_preview.py');
    try {
        const { stdout } = await execFileAsync('python3', [pythonPreviewPath, filePath], {
            maxBuffer: 10 * 1024 * 1024
        });
        return JSON.parse(stdout);
    } catch (error) {
        console.warn("⚠️ Preview Error:", error.message);
        return { error: error.message };
    }
                                                                                                  }
