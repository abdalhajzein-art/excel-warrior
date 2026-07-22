import ExcelJS from 'exceljs';

export async function modifyExcelHandler(req, res) {
  try {
    const body = req.body || req || {};
    const { base64, instruction } = body;

    console.log(`📝 modifyExcelHandler: base64 موجود؟ ${!!base64}`);
    console.log(`📝 instruction: ${instruction}`);

    if (!base64) {
      return { success: false, error: "لا يوجد ملف Excel مرفق." };
    }

    // ✅ قراءة الملف مع الاحتفاظ بالتنسيق
    const buffer = Buffer.from(base64, 'base64');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    
    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      return { success: false, error: "لا يوجد ورقة عمل في الملف." };
    }

    console.log(`📊 عدد الصفوف: ${worksheet.rowCount}`);

    // ✅ تنفيذ التعديل المطلوب (إضافة عمود)
    const instructionLower = (instruction || "").toLowerCase();
    if (instructionLower.includes('سبب الغياب') || instructionLower.includes('عمود')) {
      
      // ✅ البحث عن عمود "الغياب"
      let targetColumnIndex = -1;
      const headerRow = worksheet.getRow(3); // الصف الثالث (العناوين)
      
      headerRow.eachCell((cell, colNumber) => {
        if (cell.value && cell.value.toString().includes('غياب')) {
          targetColumnIndex = colNumber;
        }
      });

      console.log(`🔍 تم العثور على عمود "غياب" في العمود: ${targetColumnIndex}`);

      if (targetColumnIndex !== -1) {
        // ✅ إضافة عمود جديد بعد عمود "الغياب"
        const insertColumnIndex = targetColumnIndex + 1;
        
        // إضافة العمود في كل الصفوف
        worksheet.eachRow((row, rowNumber) => {
          const cell = row.getCell(insertColumnIndex);
          if (rowNumber === 3) {
            // صف العناوين
            cell.value = 'سبب الغياب';
            cell.font = headerRow.getCell(targetColumnIndex).font; // نسخ الخط
            cell.fill = headerRow.getCell(targetColumnIndex).fill; // نسخ اللون
            cell.border = headerRow.getCell(targetColumnIndex).border; // نسخ الحدود
          } else {
            // باقي الصفوف (فارغة)
            cell.value = '';
            // نسخ التنسيق من العمود المجاور
            const sourceCell = row.getCell(targetColumnIndex);
            cell.font = sourceCell.font;
            cell.fill = sourceCell.fill;
            cell.border = sourceCell.border;
            cell.alignment = sourceCell.alignment;
          }
        });

        console.log(`✅ تم إضافة عمود "سبب الغياب" بعد عمود "الغياب" مع الاحتفاظ بالتنسيق`);
      } else {
        console.warn(`⚠️ لم يتم العثور على عمود "غياب"، نضيف في النهاية`);
        // نضيف العمود في النهاية
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

    // ✅ حفظ الملف مع الاحتفاظ بالتنسيق
    const outputBuffer = await workbook.xlsx.writeBuffer();

    return {
      success: true,
      message: "✅ تم تعديل الملف بنجاح مع الاحتفاظ بالتنسيق",
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
