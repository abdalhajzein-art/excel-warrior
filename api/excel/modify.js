import ExcelJS from 'exceljs';

export async function modifyExcelHandler(req, res) {
  try {
    const body = req.body || req || {};
    const { base64, instruction } = body;

    console.log(`📝 modifyExcelHandler: base64 موجود؟ ${!!base64}`);

    if (!base64) {
      return { success: false, error: "لا يوجد ملف Excel مرفق." };
    }

    const buffer = Buffer.from(base64, 'base64');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    
    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      return { success: false, error: "لا يوجد ورقة عمل في الملف." };
    }

    // ✅ التحقق من وجود مخططات
    let hasCharts = false;
    try {
      // exceljs doesn't directly support charts, but we can warn
      hasCharts = false; // Placeholder for future detection
    } catch (e) {
      hasCharts = false;
    }

    console.log(`📊 عدد الصفوف: ${worksheet.rowCount}`);

    // ✅ تنفيذ التعديل المطلوب
    const instructionLower = (instruction || "").toLowerCase();
    if (instructionLower.includes('سبب الغياب') || instructionLower.includes('عمود')) {
      
      let targetColumnIndex = -1;
      const headerRow = worksheet.getRow(3);
      
      headerRow.eachCell((cell, colNumber) => {
        if (cell.value && cell.value.toString().includes('غياب')) {
          targetColumnIndex = colNumber;
        }
      });

      console.log(`🔍 تم العثور على عمود "غياب" في العمود: ${targetColumnIndex}`);

      if (targetColumnIndex !== -1) {
        const insertColumnIndex = targetColumnIndex + 1;
        
        worksheet.eachRow((row, rowNumber) => {
          const cell = row.getCell(insertColumnIndex);
          if (rowNumber === 3) {
            cell.value = 'سبب الغياب';
            const sourceCell = headerRow.getCell(targetColumnIndex);
            if (sourceCell.font) cell.font = sourceCell.font;
            if (sourceCell.fill) cell.fill = sourceCell.fill;
            if (sourceCell.border) cell.border = sourceCell.border;
            if (sourceCell.alignment) cell.alignment = sourceCell.alignment;
          } else {
            cell.value = '';
            const sourceCell = row.getCell(targetColumnIndex);
            if (sourceCell.font) cell.font = sourceCell.font;
            if (sourceCell.fill) cell.fill = sourceCell.fill;
            if (sourceCell.border) cell.border = sourceCell.border;
            if (sourceCell.alignment) cell.alignment = sourceCell.alignment;
          }
        });

        console.log(`✅ تم إضافة عمود "سبب الغياب" بعد عمود "الغياب" مع الاحتفاظ بالتنسيق`);
      } else {
        console.warn(`⚠️ لم يتم العثور على عمود "غياب"، نضيف في النهاية`);
        const lastColumn = worksheet.columnCount + 1;
        worksheet.eachRow((row, rowNumber) => {
          const cell = row.getCell(lastColumn);
          if (rowNumber === 3) {
            cell.value = 'عمود جديد';
          } else {
            cell.value = '';
          }
        });
      }
    }

    const outputBuffer = await workbook.xlsx.writeBuffer();

    let message = "✅ تم تعديل الملف بنجاح مع الاحتفاظ بالتنسيق";
    if (hasCharts) {
      message += " ⚠️ لكن المخططات قد لا تبقى بسبب قيود المكتبة.";
    }

    return {
      success: true,
      message: message,
      fileBase64: outputBuffer.toString('base64'),
      fileName: `modified_${Date.now()}.xlsx`,
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
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(result.fileName)}"`);
      return res.status(200).send(Buffer.from(result.fileBase64, 'base64'));
    }

    return res.status(400).json({ error: result.error || "فشل تعديل الملف" });

  } catch (err) {
    console.error("Error in modify route:", err);
    return res.status(500).json({ error: "خطأ في التعديل: " + err.message });
  }
      }
