import ExcelJS from 'exceljs';
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

    // 1. استخلاص الهيكل الذكي
    const metaResult = await extractExcelMetadata(buffer);
    if (!metaResult.success) {
      return { success: false, error: "فشل استخلاص هيكل الملف: " + metaResult.error };
    }

    // 2. طلب خطة العمل المفتوحة من عقل Groq بناءً على طلب المستخدم الحقيقي
    const aiResponse = await askGroqStructured(
      metaResult.metadata, 
      instruction || "تعديل وتطوير الملف حسب طلب المستخدم"
    );
    
    let aiPlan = {
      actionType: "custom",
      targetColumn: null,
      newColumns: [],
      formula: null,
      modificationsDescription: ["تعديل الملف وتطويره عبر الأثير AI"]
    };

    if (aiResponse.success && aiResponse.data) {
      aiPlan = aiResponse.data;
    }

    // 3. تحميل الملف والتعديل عليه برمجياً وبكل مرونة
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.getWorksheet(1);
    
    if (!worksheet) {
      return { success: false, error: "لا يوجد ورقة عمل في الملف." };
    }

    let modifications = aiPlan.modificationsDescription || [];

    // البحث عن صف العناوين ديناميكياً بدقة
    let headerRowIndex = -1;
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        const val = cell.value ? cell.value.toString().trim() : '';
        if (val === 'رقم الموظف' || val === 'اسم الموظف' || val.includes('الاسم') || val.includes('اليوم') || val.includes('الغياب')) {
          if (headerRowIndex === -1) headerRowIndex = rowNumber;
        }
      });
    });

    if (headerRowIndex === -1) headerRowIndex = 2;
    const headerRow = worksheet.getRow(headerRowIndex);

    // تنسيق صف العناوين الملكي
    headerRow.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1F4E78' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    // التنفيذ الديناميكي للإدراج الحقيقي باستخدام spliceColumns لضمان عدم تخريب الجدول
    if (aiPlan.newColumns && Array.isArray(aiPlan.newColumns) && aiPlan.newColumns.length > 0) {
      let targetColIdx = -1;
      
      // البحث عن عمود الهدف (مثلاً: الغياب)
      headerRow.eachCell((cell, colNum) => {
        const cellVal = cell.value ? cell.value.toString().trim() : '';
        if (aiPlan.targetColumn && cellVal.includes(aiPlan.targetColumn)) {
          targetColIdx = colNum;
        } else if (!aiPlan.targetColumn && (cellVal.includes('الغياب') || cellVal === 'غياب')) {
          targetColIdx = colNum;
        }
      });
      
      // إذا لم يتم العثور على عمود محدد، نجعله بعد العمود الأخير للجدول أو نفتحه بالمنتصف
      let insertIndex = targetColIdx !== -1 ? targetColIdx + 1 : worksheet.columnCount + 1;

      // إدراج الأعمدة الجديدة باستخدام spliceColumns الصحيحة برمجياً
      aiPlan.newColumns.forEach((colName, idx) => {
        const currentInsertPos = insertIndex + idx;
        
        // بناء مصفوفة القيم للعمود الجديد (العنوان + بيانات افتراضية لكل صف)
        const colValues = [colName];
        const rowCount = worksheet.rowCount;
        
        for (let i = headerRowIndex + 1; i <= rowCount; i++) {
          const row = worksheet.getRow(i);
          let defaultVal = "-";
          if (colName.includes('سبب')) {
            defaultVal = "مرض";
          } else if (colName.includes('ملاحظات')) {
            defaultVal = "بدون ملاحظات";
          }
          colValues.push(row.getCell(1).value ? defaultVal : null);
        }

        // إدراج العمود فعلياً وإزاحة الأعمدة القائمة بمعاونة exceljs
        worksheet.spliceColumns(currentInsertPos, 0, colValues);
        
        // تطبيق تنسيق العنوان على الخلية الجديدة
        const newHeaderCell = worksheet.getCell(headerRowIndex, currentInsertPos);
        newHeaderCell.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFF' } };
        newHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1F4E78' } };
        newHeaderCell.alignment = { vertical: 'middle', horizontal: 'center' };
      });

      modifications.push(`إدراج الأعمدة الجديدة (${aiPlan.newColumns.join(', ')}) في مكانها بدقة بجانب عمود الهدف بنجاح`);
    }

    // حفظ الملف وإرجاعه
    const outputBuffer = await workbook.xlsx.writeBuffer();
    let message = "✅ تم تعديل الملف ديناميكياً بنجاح:\n" + modifications.map((m, i) => `${i+1}. ${m}`).join('\n');

    return {
      success: true,
      message: message,
      fileBase64: outputBuffer.toString('base64'),
      fileName: `Alatheer_Dynamic_${Date.now()}.xlsx`,
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

