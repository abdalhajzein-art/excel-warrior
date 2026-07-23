import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { askGroqStructured } from '../groqService.js';

export async function generateExcelHandler(req, res) {
  try {
    const body = req.body || req || {};
    const { instruction } = body;

    if (!instruction) {
      return { success: false, error: "يرجى تقديم وصف لجدول الإكسل المراد توليده." };
    }

    // 1. طلب خطة تصميم الجدول من عقل Groq
    const prompt = `أنشئ جدول إكسل بناءً على الطلب التالي: "${instruction}". رجّع النتيجة بـ JSON يحتوي على:
    - headers: مصفوفة بأسماء الأعمدة (مثل ["رقم", "الاسم", "المبلغ"])
    - rows: مصفوفة مصفوفات تحتوي على 3 إلى 5 صفوف بيانات تجريبية واقعية مطابقة للطلب.`;

    const aiResponse = await askGroqStructured({}, prompt);
    let plan = aiResponse.success && aiResponse.data ? aiResponse.data : {
      headers: ["الرقم", "العنصر", "الحالة", "التاريخ"],
      rows: [
        [1, "عنصر تجريبي 1", "نشط", "2026-07-23"],
        [2, "عنصر تجريبي 2", "قيد المعالجة", "2026-07-23"]
      ]
    };

    const tempOutputPath = path.join('/tmp', `generated_${Date.now()}.xlsx`);

    // 2. إرسال خطة التوليد إلى محرك بايثون الشامل
    const payload = JSON.stringify({
      action: "generate",
      filePath: tempOutputPath,
      plan: plan
    });

    const scriptPath = path.join(process.cwd(), 'api', 'excel', 'engine.py');
    const output = execSync(`python3 "${scriptPath}"`, {
      input: payload,
      encoding: 'utf-8'
    });

    const resultObj = JSON.parse(output.trim());
    if (!resultObj.success) {
      throw new Error(resultObj.error || "فشل محرك بايثون في التوليد");
    }

    const generatedBuffer = fs.readFileSync(tempOutputPath);
    try { fs.unlinkSync(tempOutputPath); } catch(e) {}

    return {
      success: true,
      message: "✅ تم توليد ملف الإكسل من الصفر باحترافية مطلقة.",
      fileBase64: generatedBuffer.toString('base64'),
      fileName: `Alatheer_Generated_${Date.now()}.xlsx`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };

  } catch (error) {
    console.error("❌ Error in Generate Excel:", error);
    return { success: false, error: "خطأ في توليد الملف: " + error.message };
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const result = await generateExcelHandler(body);

    if (result.success && result.fileBase64) {
      res.setHeader("Content-Type", result.contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(result.fileName)}"`);
      return res.status(200).send(Buffer.from(result.fileBase64, 'base64'));
    }

    return res.status(400).json({ error: result.error || "فشل توليد الملف" });
  } catch (err) {
    return res.status(500).json({ error: "خطأ داخلي: " + err.message });
  }
}

