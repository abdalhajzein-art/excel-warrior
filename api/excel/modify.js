import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { extractExcelMetadata } from './metadata.js';
import { askGroqStructured } from '../groqService.js';

export async function modifyExcelHandler(req, res) {
  try {
    const body = req.body || req || {};
    const { base64, instruction, action = "modify" } = body;

    let tempInputPath = path.join('/tmp', `input_${Date.now()}.xlsx`);
    let metaResult = { metadata: {} };

    if (base64) {
      const buffer = Buffer.from(base64, 'base64');
      fs.writeFileSync(tempInputPath, buffer);
      metaResult = await extractExcelMetadata(buffer);
    }

    const aiResponse = await askGroqStructured(metaResult.metadata, instruction || "تعديل الملف وتطويره");
    let aiPlan = aiResponse.success && aiResponse.data ? aiResponse.data : { newColumns: ["سبب الغياب", "ملاحظات"] };

    const payload = JSON.stringify({
      action: action,
      filePath: tempInputPath,
      plan: aiPlan
    });

    const scriptPath = path.join(process.cwd(), 'api', 'excel', 'engine.py');
    const output = execSync(`python3 "${scriptPath}"`, {
      input: payload,
      encoding: 'utf-8'
    });

    const resultObj = JSON.parse(output.trim());
    if (!resultObj.success) {
      throw new Error(resultObj.error || "فشل محرك بايثون");
    }

    const modifiedBuffer = fs.readFileSync(tempInputPath);
    try { fs.unlinkSync(tempInputPath); } catch(e) {}

    return {
      success: true,
      message: "✅ تم تنفيذ الطلب بنجاح عبر ملكوت إكسل السيادي.",
      fileBase64: modifiedBuffer.toString('base64'),
      fileName: `Alatheer_Absolute_${Date.now()}.xlsx`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };

  } catch (error) {
    console.error("❌ Error in Absolute Excel Engine:", error);
    return { success: false, error: "خطأ في المحرك الشامل: " + error.message };
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

    return res.status(400).json({ error: result.error || "فشل معالجة الطلب" });
  } catch (err) {
    return res.status(500).json({ error: "خطأ داخلي: " + err.message });
  }
}
