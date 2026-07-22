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

    const buffer = Buffer.from(base64, 'base64');
    
    // ✅ قراءة الملف باستخدام exceljs
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.getWorksheet(1);
    
    if (!worksheet) {
      return { success: false, error: "لا يوجد ورقة عمل في الملف." };
    }

    const instructionLower = (instruction || "").toLowerCase();
    let modifications = [];

    // ============================================================
    // 1️⃣ إدارة الأعمدة
    // ============================================================

    // 1.1 إضافة عمود
    if (instructionLower.includes('إضافة عمود') || instructionLower.includes('اضافة عمود') || 
        instructionLower.includes('ضيف عمود') || instructionLower.includes('أضف عمود')) {
      
      // استخراج اسم العمود الجديد
      let newColumnName = 'عمود جديد';
      const nameMatch = instruction.match(/["']([^"']+)["']/);
      if (nameMatch) {
        newColumnName = nameMatch[1];
      } else {
        const nameAfter = instruction.match(/اسمه\s*([^\s,،]+)/i);
        if (nameAfter) newColumnName = nameAfter[1];
      }

      // تحديد مكان الإضافة
      let targetColumnName = null;
      const afterMatch = instruction.match(/بعد\s*["']?([^"'\s,،]+)["']?/i);
      const beforeMatch = instruction.match(/قبل\s*["']?([^"'\s,،]+)["']?/i);
      
      if (afterMatch) targetColumnName = afterMatch[1];
      else if (beforeMatch) targetColumnName = beforeMatch[1];

      // البحث عن العمود المستهدف
      let targetColumnIndex = -1;
      const headerRow = worksheet.getRow(3);
      
      if (targetColumnName) {
        headerRow.eachCell((cell, colNumber) => {
          if (cell.value && cell.value.toString().toLowerCase().includes(targetColumnName.toLowerCase())) {
            targetColumnIndex = colNumber;
          }
        });
      }

      if (targetColumnIndex === -1) {
        targetColumnIndex = worksheet.columnCount;
      }

      // تحديد مكان الإضافة
      let insertIndex;
      if (afterMatch && targetColumnIndex !== -1) {
        insertIndex = targetColumnIndex + 1;
      } else if (beforeMatch && targetColumnIndex !== -1) {
        insertIndex = targetColumnIndex;
      } else {
        insertIndex = worksheet.columnCount + 1;
      }

      // ✅ إضافة عمود في exceljs
      worksheet.spliceColumns(insertIndex, 0, []);
      const rowCount = worksheet.rowCount;
      
      for (let i = 1; i <= rowCount; i++) {
        const cell = worksheet.getCell(i, insertIndex);
        if (i === 3) {
          cell.value = newColumnName;
          // ✅ نسخ التنسيق من العمود المجاور
          const sourceCol = insertIndex > 1 ? insertIndex - 1 : insertIndex + 1;
          const sourceCell = worksheet.getCell(i, sourceCol);
          if (sourceCell.font) cell.font = sourceCell.font;
          if (sourceCell.fill) cell.fill = sourceCell.fill;
          if (sourceCell.border) cell.border = sourceCell.border;
          if (sourceCell.alignment) cell.alignment = sourceCell.alignment;
        } else if (i > 3) {
          cell.value = '';
          // ✅ نسخ التنسيق من العمود المجاور
          const sourceCol = insertIndex > 1 ? insertIndex - 1 : insertIndex + 1;
          const sourceCell = worksheet.getCell(i, sourceCol);
          if (sourceCell.font) cell.font = sourceCell.font;
          if (sourceCell.fill) cell.fill = sourceCell.fill;
          if (sourceCell.border) cell.border = sourceCell.border;
          if (sourceCell.alignment) cell.alignment = sourceCell.alignment;
        }
      }
      
      modifications.push(`إضافة عمود "${newColumnName}"`);
    }

    // 1.2 حذف عمود
    if (instructionLower.includes('حذف عمود') || instructionLower.includes('ازالة عمود') || 
        instructionLower.includes('إزالة عمود') || instructionLower.includes('مسح عمود')) {
      
      let columnToDelete = null;
      const deleteMatch = instruction.match(/حذف\s*["']?([^"'\s,،]+)["']?/i) || 
                          instruction.match(/ازالة\s*["']?([^"'\s,،]+)["']?/i);
      
      if (deleteMatch) columnToDelete = deleteMatch[1];

      if (columnToDelete) {
        let deleteIndex = -1;
        const headerRow = worksheet.getRow(3);
        headerRow.eachCell((cell, colNumber) => {
          if (cell.value && cell.value.toString().toLowerCase().includes(columnToDelete.toLowerCase())) {
            deleteIndex = colNumber;
          }
        });
        if (deleteIndex !== -1) {
          worksheet.spliceColumns(deleteIndex, 1);
          modifications.push(`حذف عمود "${columnToDelete}"`);
        }
      }
    }

    // 1.3 تغيير اسم عمود
    if (instructionLower.includes('تغيير اسم عمود') || instructionLower.includes('تعديل اسم عمود') || 
        instructionLower.includes('إعادة تسمية عمود')) {
      
      const renameMatch = instruction.match(/تغيير\s*["']?([^"'\s,،]+)["']?\s*إلى\s*["']?([^"'\s,،]+)["']?/i) ||
                          instruction.match(/إعادة تسمية\s*["']?([^"'\s,،]+)["']?\s*إلى\s*["']?([^"'\s,،]+)["']?/i);
      
      if (renameMatch) {
        const oldName = renameMatch[1];
        const newName = renameMatch[2];
        const headerRow = worksheet.getRow(3);
        headerRow.eachCell((cell) => {
          if (cell.value && cell.value.toString().toLowerCase().includes(oldName.toLowerCase())) {
            cell.value = newName;
            modifications.push(`تغيير اسم عمود "${oldName}" إلى "${newName}"`);
          }
        });
      }
    }

    // 1.4 نسخ عمود
    if (instructionLower.includes('نسخ عمود') || instructionLower.includes('تكرار عمود')) {
      const copyMatch = instruction.match(/نسخ\s*["']?([^"'\s,،]+)["']?/i);
      if (copyMatch) {
        const columnName = copyMatch[1];
        let sourceIndex = -1;
        const headerRow = worksheet.getRow(3);
        headerRow.eachCell((cell, colNumber) => {
          if (cell.value && cell.value.toString().toLowerCase().includes(columnName.toLowerCase())) {
            sourceIndex = colNumber;
          }
        });
        if (sourceIndex !== -1) {
          const newIndex = worksheet.columnCount + 1;
          worksheet.spliceColumns(newIndex, 0, []);
          const rowCount = worksheet.rowCount;
          for (let i = 1; i <= rowCount; i++) {
            const sourceCell = worksheet.getCell(i, sourceIndex);
            const newCell = worksheet.getCell(i, newIndex);
            if (i === 3) newCell.value = `${columnName}_نسخة`;
            else newCell.value = sourceCell.value;
          }
          modifications.push(`نسخ عمود "${columnName}"`);
        }
      }
    }

    // ============================================================
    // 2️⃣ إدارة الصفوف
    // ============================================================

    // 2.1 إضافة صف
    if (instructionLower.includes('إضافة صف') || instructionLower.includes('اضافة صف') || 
        instructionLower.includes('ضيف صف') || instructionLower.includes('أضف صف')) {
      
      const dataMatch = instruction.match(/\[([^\]]+)\]/);
      const rowData = dataMatch ? dataMatch[1].split(',').map(item => item.trim()) : [];
      const newRowIndex = worksheet.rowCount + 1;
      
      worksheet.spliceRows(newRowIndex, 0, []);
      
      if (rowData.length > 0) {
        rowData.forEach((value, index) => {
          worksheet.getCell(newRowIndex, index + 1).value = value;
        });
        modifications.push(`إضافة صف جديد: ${rowData.join(', ')}`);
      } else {
        modifications.push(`إضافة صف فارغ`);
      }
    }

    // 2.2 حذف صف
    if (instructionLower.includes('حذف صف') || instructionLower.includes('ازالة صف')) {
      const rowMatch = instruction.match(/(\d+)/);
      if (rowMatch) {
        const rowNumber = parseInt(rowMatch[1]);
        if (rowNumber > 0 && rowNumber <= worksheet.rowCount) {
          worksheet.spliceRows(rowNumber, 1);
          modifications.push(`حذف الصف ${rowNumber}`);
        }
      }
    }

    // ============================================================
    // 3️⃣ تعديل البيانات
    // ============================================================

    // 3.1 استبدال النصوص
    if (instructionLower.includes('استبدال') || instructionLower.includes('تغيير') || 
        instructionLower.includes('تعديل')) {
      
      const fromMatch = instruction.match(/من\s*["']?([^"'\s,،]+)["']?\s*إلى\s*["']?([^"'\s,،]+)["']?/i);
      if (fromMatch) {
        const oldValue = fromMatch[1];
        const newValue = fromMatch[2];
        let modifiedCount = 0;
        const rowCount = worksheet.rowCount;
        const colCount = worksheet.columnCount;
        for (let i = 1; i <= rowCount; i++) {
          for (let j = 1; j <= colCount; j++) {
            const cell = worksheet.getCell(i, j);
            if (cell.value && cell.value.toString() === oldValue) {
              cell.value = newValue;
              modifiedCount++;
            }
          }
        }
        modifications.push(`استبدال "${oldValue}" إلى "${newValue}" (${modifiedCount} خلية)`);
      }
    }

    // ============================================================
    // 4️⃣ التنسيق
    // ============================================================

    // 4.1 تغيير لون خلفية عمود
    if (instructionLower.includes('لون خلفية') || instructionLower.includes('تغيير لون')) {
      const colorMatch = instruction.match(/(#[0-9A-Fa-f]{6})|(أحمر|أزرق|أخضر|أصفر|أسود|أبيض)/i);
      const colMatch = instruction.match(/عمود\s*["']?([^"'\s,،]+)["']?/i);
      if (colorMatch && colMatch) {
        let color = colorMatch[1] || colorMatch[2];
        const colName = colMatch[1];
        let colIndex = -1;
        const headerRow = worksheet.getRow(3);
        headerRow.eachCell((cell, colNumber) => {
          if (cell.value && cell.value.toString().toLowerCase().includes(colName.toLowerCase())) {
            colIndex = colNumber;
          }
        });
        if (colIndex !== -1) {
          const rowCount = worksheet.rowCount;
          for (let i = 1; i <= rowCount; i++) {
            const cell = worksheet.getCell(i, colIndex);
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
          }
          modifications.push(`تغيير لون عمود "${colName}" إلى ${color}`);
        }
      }
    }

    // 4.2 دمج خلايا
    if (instructionLower.includes('دمج') && !instructionLower.includes('دمج ملفات')) {
      const rangeMatch = instruction.match(/([A-Z]+\d+):([A-Z]+\d+)/i);
      if (rangeMatch) {
        try {
          worksheet.mergeCells(rangeMatch[0]);
          modifications.push(`دمج الخلايا ${rangeMatch[0]}`);
        } catch (e) {
          console.warn(`⚠️ فشل دمج الخلايا: ${e.message}`);
        }
      }
    }

    // 4.3 إضافة تعليق
    if (instructionLower.includes('تعليق') || instructionLower.includes('ملاحظة')) {
      const commentMatch = instruction.match(/تعليق\s*["']([^"']+)["']/i);
      if (commentMatch) {
        const commentText = commentMatch[1];
        const cellMatch = instruction.match(/([A-Z]+\d+)/i);
        const targetCell = cellMatch ? worksheet.getCell(cellMatch[1]) : worksheet.getCell('A1');
        targetCell.note = { texts: [{ text: commentText }] };
        modifications.push(`إضافة تعليق: "${commentText}"`);
      }
    }

    // ============================================================
    // حفظ الملف
    // ============================================================
    const outputBuffer = await workbook.xlsx.writeBuffer();

    let message = "✅ تم تعديل الملف بنجاح";
    if (modifications.length > 0) {
      message = `✅ تم تعديل الملف بنجاح:\n${modifications.map((m, i) => `${i+1}. ${m}`).join('\n')}`;
    } else {
      message = "⚠️ لم يتم تنفيذ أي تعديل. تأكد من صياغة الطلب بشكل واضح.";
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
