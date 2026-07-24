import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { extractExcelMetadata } from './metadata.js';

export async function modifyExcelHandler({
  base64,
  instruction,
  targetColumn = null,
  newColumns = [],
  formulaTemplate = null,
  dropdownOptions = null,
  fileName = 'modified.xlsx'
}) {
  if (!base64) {
    return {
      success: false,
      error: "⚠️ لا يوجد ملف مرفق للتعديل. يرجى تحميل ملف Excel أولاً."
    };
  }

  let tempInputPath = null;
  let tempOutputPath = null;

  try {
    const timestamp = Date.now();
    tempInputPath = path.join('/tmp', `input_${timestamp}.xlsx`);
    tempOutputPath = path.join('/tmp', `output_${timestamp}.xlsx`);

    const buffer = Buffer.from(base64, 'base64');
    fs.writeFileSync(tempInputPath, buffer);

    let metadata = {};
    try {
      const metaResult = await extractExcelMetadata(buffer);
      metadata = metaResult.metadata || {};
    } catch (metaErr) {
      console.warn("⚠️ تعذر استخراج البيانات الوصفية:", metaErr.message);
    }

    const aiPlan = {
      summary: instruction || "تعديل الملف بناءً على تعليمات المستخدم",
      newColumns: newColumns.length > 0 ? newColumns : [],
      targetColumn: targetColumn,
      formulaTemplate: formulaTemplate,
      dropdownOptions: dropdownOptions
    };

    const payload = JSON.stringify({
      action: 'modify',
      inputPath: tempInputPath,
      outputPath: tempOutputPath,
      plan: aiPlan
    });

    console.log(`📤 إرسال البيانات لمحرك Python: ${payload}`);

    const scriptPath = path.join(process.cwd(), 'api', 'excel', 'engine.py');
    const pythonProcess = spawn('python3', [scriptPath]);
    
    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => { stdout += data.toString(); });
    pythonProcess.stderr.on('data', (data) => { stderr += data.toString(); });

    pythonProcess.stdin.write(payload);
    pythonProcess.stdin.end();

    const timeoutMs = 120000;
    await Promise.race([
      new Promise((resolve, reject) => {
        pythonProcess.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`Python exited with code ${code}\nStderr: ${stderr}`));
        });
        pythonProcess.on('error', (err) => reject(err));
      }),
      new Promise((_, reject) => 
        setTimeout(() => {
          pythonProcess.kill('SIGTERM');
          reject(new Error(`انتهت المهلة بعد ${timeoutMs/1000} ثانية`));
        }, timeoutMs)
      )
    ]);

    let resultObj;
    try {
      resultObj = JSON.parse(stdout.trim());
    } catch (parseErr) {
      throw new Error("مخرجات غير صالحة من محرك Python");
    }

    if (!resultObj.success) {
      throw new Error(resultObj.error || "فشل محرك Python في معالجة الملف");
    }

    let modifiedBuffer;
    if (fs.existsSync(tempOutputPath)) {
      modifiedBuffer = fs.readFileSync(tempOutputPath);
    } else if (fs.existsSync(tempInputPath)) {
      modifiedBuffer = fs.readFileSync(tempInputPath);
    } else {
      throw new Error("لم يتم العثور على الملف المعدل");
    }

    try {
      if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
      if (fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
    } catch (cleanErr) {}

    return {
      success: true,
      message: resultObj.message || "✅ تم تعديل الملف بنجاح وتجهيز رابط التحميل!",
      fileBase64: modifiedBuffer.toString('base64'),
      fileName: `modified_${fileName}`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      summary: aiPlan.summary
    };

  } catch (error) {
    console.error("❌ خطأ في modifyExcelHandler:", error);
    try {
      if (tempInputPath && fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
      if (tempOutputPath && fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
    } catch (e) {}

    return {
      success: false,
      error: error.message || "حدث خطأ أثناء معالجة الملف"
    };
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
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
      return res.status(200).json(result);
    }

    return res.status(400).json({ error: result.error || "فشل معالجة الطلب" });
  } catch (err) {
    return res.status(500).json({ error: "خطأ داخلي في الخادم: " + err.message });
  }
}

