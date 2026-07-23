import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { extractExcelMetadata } from './metadata.js';
import { askGroqStructured } from '../groqService.js';

const execAsync = promisify(exec);

/**
 * تعديل ملف Excel بناءً على تعليمات المستخدم وخطة الذكاء الاصطناعي
 * @param {Object} params - معاملات التعديل
 * @param {string} params.base64 - الملف بصيغة base64
 * @param {string} params.instruction - تعليمات المستخدم
 * @param {string} params.targetColumn - العمود المستهدف
 * @param {string[]} params.newColumns - الأعمدة الجديدة
 * @param {string} params.formulaTemplate - صيغة مخصصة
 * @param {string[]} params.dropdownOptions - خيارات القائمة المنسدلة
 * @param {string} params.fileName - اسم الملف الأصلي
 */
export async function modifyExcelHandler({
  base64,
  instruction,
  targetColumn = null,
  newColumns = [],
  formulaTemplate = null,
  dropdownOptions = null,
  fileName = 'modified.xlsx'
}) {
  // التحقق من وجود الملف
  if (!base64) {
    return {
      success: false,
      error: "⚠️ لا يوجد ملف مرفق للتعديل. يرجى تحميل ملف Excel أولاً."
    };
  }

  let tempInputPath = null;
  let tempOutputPath = null;

  try {
    // 1️⃣ إنشاء ملف مؤقت للإدخال
    const timestamp = Date.now();
    tempInputPath = path.join('/tmp', `input_${timestamp}.xlsx`);
    tempOutputPath = path.join('/tmp', `output_${timestamp}.xlsx`);

    const buffer = Buffer.from(base64, 'base64');
    fs.writeFileSync(tempInputPath, buffer);

    // 2️⃣ استخراج بيانات الملف (Metadata)
    let metadata = {};
    try {
      const metaResult = await extractExcelMetadata(buffer);
      metadata = metaResult.metadata || {};
    } catch (metaErr) {
      console.warn("⚠️ تعذر استخراج البيانات الوصفية، نكمل بدونها:", metaErr.message);
    }

    // 3️⃣ تحليل الطلب عبر Groq (إذا لم تكن الخطة محددة مسبقاً)
    let aiPlan = {
      summary: instruction || "تعديل الملف بناءً على تعليمات المستخدم",
      newColumns: newColumns.length > 0 ? newColumns : [],
      targetColumn: targetColumn,
      formulaTemplate: formulaTemplate,
      dropdownOptions: dropdownOptions
    };

    if (!newColumns.length && !targetColumn && !formulaTemplate) {
      // إذا لم تكن التفاصيل محددة، نسأل Groq
      const aiResponse = await askGroqStructured(metadata, instruction || "قم بتحليل الملف واقتراح تحسينات");
      if (aiResponse.success && aiResponse.data) {
        aiPlan = {
          summary: aiResponse.data.summary || instruction,
          newColumns: aiResponse.data.newColumns || [],
          targetColumn: aiResponse.data.targetColumn || null,
          formulaTemplate: aiResponse.data.formulaTemplate || null,
          dropdownOptions: aiResponse.data.dropdownOptions || null,
          actionType: aiResponse.data.actionType || 'custom'
        };
      }
    }

    // 4️⃣ بناء البيانات المرسلة لمحرك Python
    const payload = JSON.stringify({
      action: 'modify',
      inputPath: tempInputPath,
      outputPath: tempOutputPath,
      plan: {
        instruction: aiPlan.summary || instruction,
        targetColumn: aiPlan.targetColumn || null,
        newColumns: aiPlan.newColumns || [],
        formulaTemplate: aiPlan.formulaTemplate || null,
        dropdownOptions: aiPlan.dropdownOptions || null,
        actionType: aiPlan.actionType || 'custom'
      }
    });

    console.log(`📤 إرسال البيانات لمحرك Python: ${payload}`);

    // 5️⃣ تشغيل محرك Python (غير متزامن)
    const scriptPath = path.join(process.cwd(), 'api', 'excel', 'engine.py');
    const { stdout, stderr } = await execAsync(`python3 "${scriptPath}"`, {
      input: payload,
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024 // 50MB للتعامل مع الملفات الكبيرة
    });

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
      throw new Error(resultObj.error || "فشل محرك Python في معالجة الملف");
    }

    // 7️⃣ قراءة الملف المعدل
    let modifiedBuffer;
    if (fs.existsSync(tempOutputPath)) {
      modifiedBuffer = fs.readFileSync(tempOutputPath);
    } else if (fs.existsSync(tempInputPath)) {
      // إذا لم يتم إنشاء ملف جديد، نستخدم الملف الأصلي (في حالة التعديل البسيط)
      modifiedBuffer = fs.readFileSync(tempInputPath);
    } else {
      throw new Error("لم يتم العثور على الملف المعدل");
    }

    // 8️⃣ تنظيف الملفات المؤقتة
    try {
      if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
      if (fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
    } catch (cleanErr) {
      console.warn("⚠️ فشل تنظيف الملفات المؤقتة:", cleanErr.message);
    }

    // 9️⃣ إرجاع النتيجة
    return {
      success: true,
      message: resultObj.message || "✅ تم تعديل الملف بنجاح!",
      fileBase64: modifiedBuffer.toString('base64'),
      fileName: `modified_${fileName}`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      summary: aiPlan.summary,
      details: resultObj.details || {}
    };

  } catch (error) {
    console.error("❌ خطأ في modifyExcelHandler:", error);

    // تنظيف الملفات المؤقتة في حالة الخطأ
    try {
      if (tempInputPath && fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
      if (tempOutputPath && fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
    } catch (cleanErr) {
      // تجاهل
    }

    return {
      success: false,
      error: error.message || "حدث خطأ أثناء معالجة الملف"
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
    
    // استدعاء الدالة الرئيسية مع المعاملات
    const result = await modifyExcelHandler({
      base64: body.base64,
      instruction: body.instruction,
      targetColumn: body.targetColumn || null,
      newColumns: body.newColumns || [],
      formulaTemplate: body.formulaTemplate || null,
      dropdownOptions: body.dropdownOptions || null,
      fileName: body.fileName || 'modified.xlsx'
    });

    if (result.success && result.fileBase64) {
      res.setHeader("Content-Type", result.contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(result.fileName)}"`);
      return res.status(200).send(Buffer.from(result.fileBase64, 'base64'));
    }

    return res.status(400).json({ 
      error: result.error || "فشل معالجة الطلب",
      details: result.details || {}
    });

  } catch (err) {
    console.error("❌ خطأ في معالج API:", err);
    return res.status(500).json({ 
      error: "خطأ داخلي في الخادم: " + err.message 
    });
  }
  }
