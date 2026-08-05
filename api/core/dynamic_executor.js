/**
 * api/core/dynamic_executor.js – Sovereign Minimal Edition (Optimized)
 * ⚡ تنفيذ سكربت بايثون على ملف إكسل مع نسخ احتياطي، استعادة عند الخطأ، وحماية من ثغرات الحقن.
 */

import fs from "fs";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execFileAsync = promisify(execFile);

export async function executeDynamicPython(pythonCode, targetFilePath) {
    return new Promise((resolve) => {
        if (!targetFilePath || !fs.existsSync(targetFilePath)) {
            return resolve({ success: false, error: "مسار الملف غير موجود أو غير صالح." });
        }

        const ext = path.extname(targetFilePath);
        const base = targetFilePath.slice(0, -ext.length);
        const backupPath = `${base}_bak_${Date.now()}${ext}`;

        const scriptName = `temp_script_${Date.now()}_${Math.floor(Math.random() * 1000)}.py`;
        const scriptPath = path.join(process.cwd(), scriptName);

        try {
            // 1. أخذ نسخة احتياطية (لحماية الملف الأصلي)
            fs.copyFileSync(targetFilePath, backupPath);

            // 2. كتابة سكربت بايثون المؤقت
            fs.writeFileSync(scriptPath, pythonCode, "utf8");

            // 3. التنفيذ الآمن باستخدام execFile بدلاً من exec
            execFile(
                "python3", 
                [scriptPath, targetFilePath], 
                { maxBuffer: 10 * 1024 * 1024 }, // 10 ميغابايت لمنع توقف السكربتات ذات المخرجات الطويلة
                (error, stdout, stderr) => {
                    // تنظيف: حذف السكربت المؤقت فور انتهاء التنفيذ
                    if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath);

                    if (error) {
                        console.error("❌ Python Error:", stderr || error.message);

                        // التراجع (Rollback): استعادة النسخة الأصلية إذا فشل بايثون
                        if (fs.existsSync(backupPath)) {
                            fs.copyFileSync(backupPath, targetFilePath);
                            fs.unlinkSync(backupPath);
                        }

                        return resolve({ success: false, error: stderr || error.message });
                    }

                    // نجاح: حذف النسخة الاحتياطية وتأكيد التعديل
                    if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);

                    return resolve({ success: true, output: stdout });
                }
            );
        } catch (err) {
            console.error("❌ Executor Exception:", err.message);

            // تنظيف في حال حدوث استثناء (Exception) مفاجئ
            if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath);
            if (fs.existsSync(backupPath)) {
                fs.copyFileSync(backupPath, targetFilePath);
                fs.unlinkSync(backupPath);
            }

            return resolve({ success: false, error: err.message });
        }
    });
}

export async function extractPreviewAsync(filePath) {
    const pythonPreviewPath = path.join(__dirname, "excel_preview.py");
    try {
        // التنفيذ الآمن والمباشر
        const { stdout } = await execFileAsync("python3", [pythonPreviewPath, filePath], {
            maxBuffer: 10 * 1024 * 1024
        });
        
        // محاولة استخراج JSON فقط في حال قام بايثون بطباعة تحذيرات إضافية
        const jsonMatch = stdout.match(/\{[\s\S]*\}/);
        const cleanStdout = jsonMatch ? jsonMatch[0] : stdout;

        return JSON.parse(cleanStdout);
    } catch (error) {
        console.warn("⚠️ Preview Error:", error.message);
        return { error: error.message };
    }
}
