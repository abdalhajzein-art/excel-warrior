import ExcelJS from 'exceljs';
import { extractExcelMetadata } from './metadata.js';
import { askGroqStructured } from '../groqService.js';

export async function modifyExcelHandler(req, res) {
  try {
    const body = req.body || req || {};
    const { base64, instruction } = body;

    console.log(`📝 modifyExcelHandler: base64 موجود؟ ${!!base64}`);
    console.log(`📝 instruction: ${instruction}`);

    if (!base64) {
      return { success: false, error: "لا يوجد ملف Excel مرفق." };
    }

    const buffer = Buffer.from(base64, 'base64');

    // 1. استخلاص الهيكل عبر المحقق الذكي لتوفير التوكنز
    const metaResult = await extractExcelMetadata(buffer);
    if (!metaResult.success) {
      return { success: false, error: "فشل استخلاص هيكل الملف: " + metaResult.error };
    }
    console.log(`📊 [Metadata Preprocessor] تم تحليل هيكل الملف بنجاح.`);

    // 2. استشارة عقل Groq الذكي والحصول على خطة عمل Structured JSON
    const aiResponse = await askGroqStructured(metaResult.metadata, instruction || "تحسين وتنسيق الملف بشكل احترافي");
    
    let aiPlan = {
      actionType: "custom",
      targetColumn: null,
      formula: null,
      modificationsDescription: ["تنسيق الملف وتطبيق بصمة الأثير الاحترافية"]
    };

    if (aiResponse.success && aiResponse.data) {
      aiPlan = aiResponse.data;
      console.log(`🧠 [Groq Brain]: تم استلام خطة التعديل بنجاح:`, JSON.stringify(aiPlan));
    } else {
      console.warn(`⚠️ [Groq Warning]: تعذر استشعار الذكاء الاصطناعي، سيتم المتابعة بالخطة التلقائية.`);
    }

    // 3. تطبيق التعديلات برمجياً على الملف
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.getWorksheet(1);
    
    if (!worksheet) {
      return { success: false, error: "لا يوجد ورقة عمل في الملف." };
    }

    let modifications = aiPlan.modificationsDescription || [];

    // البحث الديناميكي عن صف العناوين الفعلي
    let headerRowIndex = -1;
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        const val = cell.value ? cell.value.toString().trim() : '';
        if (val === 'رقم الموظف' || val === 'اسم الموظف' || val.includes('الاسم')) {
          if (headerRowIndex === -1) headerRowIndex = rowNumber;
        }
      });
    });

    if (headerRowIndex === -1) headerRowIndex = 2;
    const headerRow = worksheet.getRow(headerRowIndex);

    // تطبيق التنسيق الاحترافي لصف العناوين
    headerRow.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1F4E78' } }; // أزرق ملكي احترافي
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    // تنفيذ الخطة القادمة من العقل الذكي أو التعديلات العامة
    if (aiPlan.actionType === 'update_column' && aiPlan.targetColumn) {
      let targetColIndex = -1;
      headerRow.eachCell((cell, colNumber) => {
        const val = cell.value ? cell.value.toString().trim() : '';
        if (val.includes(aiPlan.targetColumn)) {
          targetColIndex = colNumber;
        }
      });

      if (targetColIndex !== -1 && aiPlan.formula) {
        const rowCount = worksheet.rowCount;
        for (let i = headerRowIndex + 1; i <= rowCount; i++) {
          const row = worksheet.getRow(i);
          if (row.getCell(1).value) {
            row.getCell(targetColIndex).value = { formula: aiPlan.formula };
          }
        }
      }
    } else {
      // تعديل افتراضي ذكي (نسبة الحضور أو بصمة الأثير)
      let percentageColIndex = -1;
      headerRow.eachCell((cell, colNumber) => {
        const val = cell.value ? cell.value.toString().trim() : '';
        if (val.includes('نسبة الحضور')) {
          percentageColIndex = colNumber;
        }
      });

      if (percentageColIndex !== -1) {
        const rowCount = worksheet.rowCount;
        for (let i = headerRowIndex + 1; i <= rowCount; i++) {
          const row = worksheet.getRow(i);
          if (row.getCell(1).value) {
            row.getCell(percentageColIndex).value = { formula: `IFERROR(COUNTIF(D${i}:H${i}, "حضور")/COUNTA(D${i}:H${i}), 0)` };
          }
        }
      }
    }

    // حفظ الملف وإرجاعه
    const outputBuffer = await workbook.xlsx.writeBuffer();
    let message = "✅ تم تعديل وتطوير الملف بنجاح عبر عقل الأثير الذكي:\n" + modifications.map((m, i) => `${i+1}. ${m}`).join('\n');

    return {
      success: true,
      message: message,
      fileBase64: outputBuffer.toString('base64'),
      fileName: `Alatheer_Smart_${Date.now()}.xlsx`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };

  } catch (error) {
    console.error("❌ Error in modifyExcelHandler:", error);
    return {
      success: false,
      error: "حدث خطأ أثناء تعديل الملف: " + error.message
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
    const result = await modifyExcelHandler(body);

    if (result.success && result.fileBase64) {
      res.setHeader("Content-Type", result.contentType || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(result.fileName)}"`);
      return res.status(200).send(Buffer.from(result.fileBase64, 'base64'));
    }

    return res.status(400).json({ error: result.error || "فشل تعديل الملف" });

  } catch (err) {
    console.error("Error in modify route:", err);
    return res.status(500).json({ error: "خطأ في التعديل: " + err.message });
  }
}
