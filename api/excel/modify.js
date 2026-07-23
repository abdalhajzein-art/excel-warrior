import ExcelJS from 'exceljs';
import { extractExcelMetadata } from './metadata.js';

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

    // 1. استخدام المحقق الذكي لاستخلاص الهيكل وتوفير التوكنز والتحليل المسبق
    const metaResult = await extractExcelMetadata(buffer);
    if (metaResult.success) {
      console.log(`📊 [Metadata Preprocessor] تم تحليل هيكل الملف بنجاح:`, JSON.stringify(metaResult.metadata));
    } else {
      console.warn(`⚠️ [Metadata Warning]: ${metaResult.error}`);
    }
    
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.getWorksheet(1);
    
    if (!worksheet) {
      return { success: false, error: "لا يوجد ورقة عمل في الملف." };
    }

    const instructionLower = (instruction || "").toLowerCase();
    let modifications = [];

    // ============================================================
    // البحث الديناميكي عن صف العناوين الفعلي (Header Row)
    // ============================================================
    let headerRowIndex = -1;
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        const val = cell.value ? cell.value.toString().trim() : '';
        if (val === 'رقم الموظف' || val === 'اسم الموظف') {
          if (headerRowIndex === -1) headerRowIndex = rowNumber;
        }
      });
    });

    // إذا لم يجد صف العناوين، نفترض أنه الصف الثاني أو الثالث كاحتياط
    if (headerRowIndex === -1) headerRowIndex = 2;

    const headerRow = worksheet.getRow(headerRowIndex);

    // ============================================================
    // التنسيق الاحترافي والتطوير
    // ============================================================
    headerRow.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1F4E78' } }; // أزرق ملكي احترافي
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    
    modifications.push(`تنسيق صف العناوين (الصف ${headerRowIndex}) بلون احترافي وتوسيط النصوص`);

    // البحث عن عمود "نسبة الحضور" أو التأكد من وجوده وتحديثه
    let percentageColIndex = -1;
    headerRow.eachCell((cell, colNumber) => {
      const val = cell.value ? cell.value.toString().trim() : '';
      if (val.includes('نسبة الحضور')) {
        percentageColIndex = colNumber;
      }
    });

    // إذا وُجد عمود نسبة الحضور، نقوم بتحديث صيغه بذكاء للصفوف التالية
    if (percentageColIndex !== -1) {
      const rowCount = worksheet.rowCount;
      for (let i = headerRowIndex + 1; i <= rowCount; i++) {
        const row = worksheet.getRow(i);
        const empIdCell = row.getCell(1).value;
        if (empIdCell) {
          row.getCell(percentageColIndex).value = { formula: `IFERROR(COUNTIF(D${i}:H${i}, "حضور")/COUNTA(D${i}:H${i}), 0)` };
        }
      }
      modifications.push('تحديث وتحسين صيغ "نسبة الحضور" لكافة الموظفين بدقة');
    } else {
      let newColIndex = worksheet.columnCount + 1;
      worksheet.getCell(headerRowIndex, newColIndex).value = 'نسبة الحضور الذكية';
      modifications.push('إضافة عمود "نسبة الحضور الذكية"');
    }

    if (modifications.length === 0) {
      worksheet.getCell('A1').value = 'تم التحديث بواسطة الأثير AI';
      modifications.push('إضافة بصمة الأثير الاحترافية للملف');
    }

    // ============================================================
    // حفظ الملف وإرجاعه
    // ============================================================
    const outputBuffer = await workbook.xlsx.writeBuffer();

    let message = "✅ تم تعديل وتطوير الملف بنجاح (مع تحليل المحقق الذكي):\n" + modifications.map((m, i) => `${i+1}. ${m}`).join('\n');

    return {
      success: true,
      message: message,
      fileBase64: outputBuffer.toString('base64'),
      fileName: `Alatheer_Pro_${Date.now()}.xlsx`,
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
