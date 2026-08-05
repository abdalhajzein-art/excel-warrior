import fs from 'fs';
import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execFileAsync = promisify(execFile);

// 1. الدالة الخارقة: تنفيذ الكود الديناميكي الذي يكتبه جيميني
export async function executeDynamicPython(pythonCode, targetFilePath) {
    return new Promise((resolve, reject) => {
        const scriptName = `temp_script_${Date.now()}_${Math.floor(Math.random() * 1000)}.py`;
        const scriptPath = path.join(process.cwd(), scriptName);

        fs.writeFileSync(scriptPath, pythonCode, 'utf8');
        console.log(`⚡ [Dynamic Executor] جاري تنفيذ السكربت المؤقت: ${scriptName}`);

        exec(`python3 "${scriptPath}" "${targetFilePath}"`, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
            if (fs.existsSync(scriptPath)) {
                fs.unlinkSync(scriptPath);
            }

            if (error) {
                console.error(`❌ [Dynamic Executor Error]:`, stderr || error.message);
                resolve({ success: false, error: stderr || error.message });
            } else {
                console.log(`✅ [Dynamic Executor Success]: التنفيذ تم بنجاح.`);
                resolve({ success: true, output: stdout });
            }
        });
    });
}

// 2. دالة المعاينة: لقراءة الملف واستخراج البيانات قبل إرسالها لجيميني
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
