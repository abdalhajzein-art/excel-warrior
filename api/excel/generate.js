import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { askGeminiStructured } from '../geminiService.js';
/**
 * توليد ملف Excel جديد من الصفر بناءً على تعليمات المستخدم
 * @param {Object} params - معاملات التوليد
 * @param {string} params.instruction - تعليمات المستخدم
 * @param {string} params.fileName - اسم الملف الناتج
 * @param {string[]} params.columns - أسماء الأعمدة
 * @param {Array} params.rows - البيانات (صفوف)
 * @param {string} params.sheetName - اسم الورقة
 */
export async function generateExcelHandler({
  instruction,
  fileName = 'generated.xlsx',
  columns = [],
  rows = [],
  sheetName = 'تقرير'
}) {
  try {
    // 1️⃣ التحقق من وجود تعليمات
    if (!instruction) {
      return {
        success: false,
        error: "⚠️ لا توجد تعليمات لتوليد الملف. يرجى توضيح المطلوب."
      };
    }

    // 2️⃣ إنشاء ملف مؤقت للإخراج
    const timestamp = Date.now();
    const outputPath = path.join('/tmp', `generated_${timestamp}.xlsx`);

    // 3️⃣ تحليل الطلب عبر Groq إذا لم يتم تحديد الأعمدة والبيانات
    let plan = {
      columns: columns,
      rows: rows,
      sheetName: sheetName,
      summary: instruction
    };

    if (!columns.length || !rows.length) {
      console.log(`📤 إرسال الطلب لـ Groq لتحليل التوليد: ${instruction}`);
      
      const groqResponse = await askGroqStructured(
        { instruction: instruction }, 
        instruction
      );

      if (groqResponse.success && groqResponse.data) {
        // استخراج الخطة من Groq
        plan = {
          columns: groqResponse.data.columns || ['رقم', 'البيان', 'التاريخ', 'القيمة'],
          rows: groqResponse.data.rows || [
            [1, 'بيان تجريبي', '2026-07-01', 1000],
            [2, 'بيان تجريبي', '2026-07-02', 1500]
          ],
          sheetName: groqResponse.data.sheetName || 'تقرير_رئيسي',
          summary: groqResponse.data.summary || instruction
        };
      } else {
        // خطة افتراضية إذا فشل Groq
        plan = {
          columns: ['رقم', 'البيان', 'التاريخ', 'القيمة'],
          rows: [
            [1, 'بيان تجريبي 1', '2026-07-01', 1000],
            [2, 'بيان تجريبي 2', '2026-07-02', 1500],
            [3, 'بيان تجريبي 3', '2026-07-03', 2000]
          ],
          sheetName: 'تقرير_رئيسي',
          summary: instruction
        };
      }
    }

    // 4️⃣ بناء البيانات المرسلة لمحرك Python
    const payload = JSON.stringify({
      action: 'generate',
      outputPath: outputPath,
      plan: {
        columns: plan.columns,
        rows: plan.rows,
        sheetName: plan.sheetName
      }
    });

    console.log(`📤 إرسال بيانات التوليد لمحرك Python: ${payload}`);

    // 5️⃣ تشغيل محرك Python باستخدام spawn
    const scriptPath = path.join(process.cwd(), 'api', 'excel', 'engine.py');
    
    const pythonProcess = spawn('python3', [scriptPath]);
    
    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // إرسال البيانات إلى stdin
    pythonProcess.stdin.write(payload);
    pythonProcess.stdin.end();

    // ✅ تعيين مهلة (timeout) لمنع التعليق
    const timeoutMs = 120000; // دقيقتين
    const timeoutError = new Error(`انتهت المهلة بعد ${timeoutMs/1000} ثانية`);

    // انتظار انتهاء العملية مع مهلة
    await Promise.race([
      new Promise((resolve, reject) => {
        pythonProcess.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Python exited with code ${code}\nStderr: ${stderr}`));
          }
        });
        pythonProcess.on('error', (err) => {
          reject(err);
        });
      }),
      new Promise((_, reject) => 
        setTimeout(() => {
          pythonProcess.kill('SIGTERM');
          reject(timeoutError);
        }, timeoutMs)
      )
    ]);

    console.log(`📥 مخرجات Python: ${stdout}`);

    if (stderr) {
      console.warn(`⚠️ تحذير من Python: ${stderr}`);
    }

    // 6️⃣ تحليل نتيجة Python
    let resultObj;
    try {
      resultObj = JSON.parse(stdout.trim());
    } catch (parseErr) {
      console.error("❌ خطأ في تحليل مخرجات Python:", stdout);
      throw new Error("مخرجات غير صالحة من محرك Python");
    }

    if (!resultObj.success) {
      throw new Error(resultObj.error || "فشل محرك Python في توليد الملف");
    }

    // 7️⃣ قراءة الملف المُولد
    if (!fs.existsSync(outputPath)) {
      throw new Error("لم يتم العثور على الملف المُولد");
    }

    const modifiedBuffer = fs.readFileSync(outputPath);

    // 8️⃣ تنظيف الملف المؤقت
    try {
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    } catch (cleanErr) {
      console.warn("⚠️ فشل تنظيف الملف المؤقت:", cleanErr.message);
    }

    // 9️⃣ إرجاع النتيجة
    return {
      success: true,
      message: resultObj.message || "✅ تم توليد الملف بنجاح!",
      fileBase64: modifiedBuffer.toString('base64'),
      fileName: `generated_${fileName}`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      summary: plan.summary,
      details: {
        columns: plan.columns,
        rows_count: plan.rows.length,
        sheetName: plan.sheetName
      }
    };

  } catch (error) {
    console.error("❌ خطأ في generateExcelHandler:", error);

    return {
      success: false,
      error: error.message || "حدث خطأ أثناء توليد الملف"
    };
  }
}

/**
 * دالة المعالج الرئيسية لـ API (للاستخدام مع Express)
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    
    const result = await generateExcelHandler({
      instruction: body.instruction,
      fileName: body.fileName || 'generated.xlsx',
      columns: body.columns || [],
      rows: body.rows || [],
      sheetName: body.sheetName || 'تقرير'
    });

    if (result.success && result.fileBase64) {
      res.setHeader("Content-Type", result.contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(result.fileName)}"`);
      return res.status(200).send(Buffer.from(result.fileBase64, 'base64'));
    }

    return res.status(400).json({ 
      error: result.error || "فشل توليد الملف",
      details: result.details || {}
    });

  } catch (err) {
    console.error("❌ خطأ في معالج API:", err);
    return res.status(500).json({ 
      error: "خطأ داخلي في الخادم: " + err.message 
    });
  }
}
