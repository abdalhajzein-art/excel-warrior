/**
 * api/core/dynamic_executor.js – Trusted Code Executor
 * 🚀 تنفيذ سيادي نظيف – يرسل فقط نتائج التنفيذ لضمان استقرار التحليل
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
    if (!targetFilePath) return resolve({ success: false, error: "مسار الملف غير صالح." });

    if (!pythonCode || typeof pythonCode !== 'string' || pythonCode.trim().length < 10) {
      console.error("❌ [Executor] الكود فارغ أو قصير جداً");
      return resolve({ success: false, error: "الكود غير صالح للتنفيذ." });
    }

    const dir = path.dirname(targetFilePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const scriptName = `temp_script_${Date.now()}_${Math.floor(Math.random() * 10000)}.py`;
    const scriptPath = path.join(process.cwd(), scriptName);

    try {
      const safeCode = `
import sys
import os
import traceback

if len(sys.argv) > 1:
    target_file = sys.argv[1]
else:
    print("ERROR: لم يتم تمرير مسار الملف")
    sys.exit(1)

${pythonCode}

if os.path.exists(target_file) and os.path.getsize(target_file) > 0:
    print("SUCCESS: تم التنفيذ بنجاح ✓")
else:
    print("ERROR: الملف غير موجود أو فارغ")
    sys.exit(1)
`;

      fs.writeFileSync(scriptPath, safeCode, "utf8");

      execFile(
        PYTHON_EXEC,
        [scriptPath, targetFilePath],
        { 
          cwd: dir, 
          maxBuffer: 50 * 1024 * 1024 
        },
        async (error, stdout, stderr) => {
          try { fs.unlinkSync(scriptPath); } catch(e) {}

          const outputStr = (stdout || "");
          const hasSuccessMark = outputStr.includes("SUCCESS: تم التنفيذ بنجاح ✓");
          const fileExists = fs.existsSync(targetFilePath) && fs.statSync(targetFilePath).size > 0;

          if (error || !hasSuccessMark || !fileExists) {
            const errorMsg = stderr || error?.message || (!hasSuccessMark ? "الكود لم يصل لعلامة النجاح" : "الملف مفقود");
            console.error("❌ [Executor] فشل:", errorMsg);
            
            return resolve({
              success: false,
              error: errorMsg,
              output: stdout,
              stderr: stderr
            });
          }

          console.log("✅ [Executor] نجاح التنفيذ");
          
          if (sessionId) {
            fusionMemory.storeCurrentFile(sessionId, targetFilePath);
            fusionMemory.storeOperation(sessionId, isNewFile ? "generate_file" : "modify_file");
          }

          return resolve({
            success: true,
            output: stdout,
            filePath: targetFilePath
          });
        }
      );

    } catch (err) {
      console.error("❌ [Executor] Exception:", err);
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
    console.warn("⚠️ [Preview] فشل:", error.message);
    return { error: error.message };
  }
}
