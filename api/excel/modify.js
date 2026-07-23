import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { extractExcelMetadata } from './metadata.js';
import { askGroqStructured } from '../groqService.js';

export async function modifyExcelHandler(req, res) {
  try {
    const body = req.body || req || {};
    const { base64, instruction } = body;

    if (!base64) {
      return { success: false, error: "لا يوجد ملف Excel مرفق." };
    }

    const buffer = Buffer.from(base64, 'base64');
    
    // استخلاص الهيكل وخطط Groq
    const metaResult = await extractExcelMetadata(buffer);
    const aiResponse = await askGroqStructured(metaResult.metadata, instruction || "تعديل الملف");
    
    let aiPlan = aiResponse.success && aiResponse.data ? aiResponse.data : { newColumns: ["سبب الغياب", "ملاحظات"] };

    // كتابة الملف في ملف مؤقت لمعالجته عبر بايثون
    const tempInputPath = path.join('/tmp', `input_${Date.now()}.xlsx`);
    fs.writeFileSync(tempInputPath, buffer);

    // تحضير البيانات لمرسليتها لسكربت البايثون
    const payload = JSON.stringify({
      filePath: tempInputPath,
      newColumns: aiPlan.newColumns || ["سبب الغياب", "ملاحظات"],
      targetColumn: aiPlan.targetColumn || null
    });

    // استدعاء سكربت البايثون السيادي لتنفيذ المعالجة المعقدة بدقة
    const scriptPath = path.join(process.cwd(), 'api', 'excel', 'modify.py');
    const pythonCmd = `python3 "${scriptPath}"`;
    
    const output = execSync(pythonCmd, {
      input: payload,
      encoding: 'utf-8'
    });

    const resultObj = JSON.parse(output.trim());
    if (!resultObj.success) {
      throw new Error(resultObj.error || "فشل معالجة بايثون");
    }

    // قراءة الملف بعد التعديل وإرجاعه كـ Buffer
    const modifiedBuffer = fs.readFileSync(tempInputPath);
    
    // تنظيف الملف المؤقت
    try { fs.unlinkSync(tempInputPath); } catch(e) {}

    return {
      success: true,
      message: "✅ تم تعديل الملف واجتياز عقدة الصيغ بنجاح عبر Python & openpyxl.",
      fileBase64: modifiedBuffer.toString('base64'),
      fileName: `Alatheer_Python_Pro_${Date.now()}.xlsx`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };

  } catch (error) {
    console.error("❌ Error in Python Bridge:", error);
    return { success: false, error: "خطأ في الجسر البرمجي: " + error.message };
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const result = await modifyExcelHandler(body);

    if (result.success && result.fileBase64) {
      res.setHeader("Content-Type", result.contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(result.fileName)}"`);
      return res.status(200).send(Buffer.from(result.fileBase64, 'base64'));
    }

    return res.status(400).json({ error: result.error || "فشل تعديل الملف" });
  } catch (err) {
    return res.status(500).json({ error: "خطأ داخلي: " + err.message });
  }
}

