/**
 * excel/utils/FileUtils.js – إدارة الملفات السيادية (النسخة النهائية المحدثة)
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

export class FileUtils {
    static async readFile(filePath) {
        if (!fs.existsSync(filePath)) {
            throw new Error(`الملف غير موجود: ${filePath}`);
        }
        return fs.readFileSync(filePath);
    }
    
    static async writeFile(filePath, data) {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        return fs.writeFileSync(filePath, data);
    }
    
    static async deleteFile(filePath) {
        if (fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
            } catch (e) {
                // تجاهل
            }
        }
    }
    
    static getTempPath(prefix = 'temp', ext = '.xlsx') {
        const dir = this.getTempDir();
        return path.join(dir, `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}${ext}`);
    }
    
    // ✅ إضافة الدالة المطلوبة لحل مشكلة الـ ExcelModifier نهائياً
    static getTempDir() {
        const tempDir = path.join(os.tmpdir(), 'alatheer_temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        return tempDir;
    }
    
    static async cleanupOldTempFiles(maxAge = 3600000) {
        try {
            const targetDir = this.getTempDir();
            const files = fs.readdirSync(targetDir);
            const now = Date.now();
            for (const file of files) {
                const filePath = path.join(targetDir, file);
                try {
                    const stats = fs.statSync(filePath);
                    if (now - stats.mtimeMs > maxAge) {
                        fs.unlinkSync(filePath);
                        console.log(`🧹 [Cleaner] تم تنظيف الملف المؤقت: ${file}`);
                    }
                } catch (err) {
                    // تجاهل
                }
            }
        } catch (e) {
            // تجاهل
        }
    }
    
    static async fileToBase64(filePath) {
        const buffer = await this.readFile(filePath);
        return buffer.toString('base64');
    }
    
    static async executePython(script, filePath, params = {}) {
        const scriptPath = this.getTempPath('script', '.py');
        const payloadPath = this.getTempPath('payload', '.json');
        
        try {
            fs.writeFileSync(payloadPath, JSON.stringify(params), 'utf-8');
            
            const fullScript = `
import json
import openpyxl
import pandas as pd

with open(r'${payloadPath}', 'r', encoding='utf-8') as f:
    params = json.load(f)

wb = openpyxl.load_workbook(r'${filePath}')
ws = wb.active

${script}

wb.save(r'${filePath}')
            `;
            
            fs.writeFileSync(scriptPath, fullScript, 'utf-8');
            // محاولة التشغيل عبر python3 أو python بحسب البيئة
            try {
                await execAsync(`python3 "${scriptPath}"`);
            } catch (e) {
                await execAsync(`python "${scriptPath}"`);
            }
            
            return true;
        } finally {
            await this.deleteFile(scriptPath);
            await this.deleteFile(payloadPath);
        }
    }
    
    static async executePythonWithOutput(script) {
        const scriptPath = this.getTempPath('script', '.py');
        
        try {
            fs.writeFileSync(scriptPath, script, 'utf-8');
            let stdout;
            try {
                const res = await execAsync(`python3 "${scriptPath}"`);
                stdout = res.stdout;
            } catch (e) {
                const res = await execAsync(`python "${scriptPath}"`);
                stdout = res.stdout;
            }
            return stdout.trim();
        } finally {
            await this.deleteFile(scriptPath);
        }
    }
}

// ✅ تنظيف تلقائي كل ساعة
setInterval(() => FileUtils.cleanupOldTempFiles(), 3600000);

export default FileUtils;

