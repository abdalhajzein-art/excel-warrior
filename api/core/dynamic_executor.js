import fs from 'fs';
import { exec } from 'child_process';
import path from 'path';

export async function executeDynamicPython(pythonCode, targetFilePath) {
    return new Promise((resolve, reject) => {
        // 1. إنشاء اسم ملف عشوائي ومؤقت للسكربت
        const scriptName = `temp_script_${Date.now()}_${Math.floor(Math.random() * 1000)}.py`;
        const scriptPath = path.join(process.cwd(), scriptName);

        // 2. حفظ كود البايثون (الذي ولده جيميني) داخل هذا الملف
        fs.writeFileSync(scriptPath, pythonCode, 'utf8');

        console.log(`⚡ [Dynamic Executor] جاري تنفيذ السكربت المؤقت: ${scriptName}`);

        // 3. تشغيل السكربت وتمرير مسار ملف الإكسل له كـ Argument
        // نستخدم maxBuffer عالي تحسباً للملفات الكبيرة
        exec(`python3 "${scriptPath}" "${targetFilePath}"`, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
            
            // 4. الحذف الفوري للسكربت بعد التنفيذ (تنظيف السيرفر)
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
