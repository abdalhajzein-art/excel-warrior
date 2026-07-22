import { Workbook } from 'xml-xlsx-lite';

export async function modifyExcelHandler(req, res) {
  try {
    const body = req.body || req || {};
    const { base64, instruction } = body;

    console.log(`📝 modifyExcelHandler: base64 موجود؟ ${!!base64}`);
    console.log(`📝 instruction: ${instruction}`);

    if (!base64) {
      return { success: false, error: "لا يوجد ملف Excel مرفق." };
    }

    // ✅ قراءة الملف
    const buffer = Buffer.from(base64, 'base64');
    const workbook = new Workbook();
    await workbook.loadFromBuffer(buffer);
    
    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      return { success: false, error: "لا يوجد ورقة عمل في الملف." };
    }

    console.log(`📊 عدد الصفوف: ${worksheet.getRowCount()}`);
    console.log(`📊 عدد الأعمدة: ${worksheet.getColumnCount()}`);

    const instructionLower = (instruction || "").toLowerCase();
    let modifications = [];

    // ============================================================
    // 1️⃣ إضافة عمود جديد
    // ============================================================
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
        targetColumnIndex = worksheet.getColumnCount();
      }

      // ✅ إضافة العمود باستخدام xml-xlsx-lite
      let insertIndex;
      if (afterMatch && targetColumnIndex !== -1) {
        insertIndex = targetColumnIndex + 1;
      } else if (beforeMatch && targetColumnIndex !== -1) {
        insertIndex = targetColumnIndex;
      } else {
        insertIndex = worksheet.getColumnCount() + 1;
      }

      // إضافة عمود جديد
      worksheet.insertColumn(insertIndex);
      
      // تعبئة العمود
      const rowCount = worksheet.getRowCount();
      for (let i = 1; i <= rowCount; i++) {
        const cell = worksheet.getCell(i, insertIndex);
        if (i === 3) {
          cell.value = newColumnName;
        } else {
          cell.value = '';
        }
      }

      modifications.push(`إضافة عمود "${newColumnName}"`);
    }

    // ============================================================
    // 2️⃣ حذف عمود
    // ============================================================
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
          worksheet.deleteColumn(deleteIndex);
          modifications.push(`حذف عمود "${columnToDelete}"`);
        }
      }
    }

    // ============================================================
    // 3️⃣ إضافة صف جديد
    // ============================================================
    if (instructionLower.includes('إضافة صف') || instructionLower.includes('اضافة صف') || 
        instructionLower.includes('ضيف صف') || instructionLower.includes('أضف صف')) {
      
      const dataMatch = instruction.match(/\[([^\]]+)\]/);
      let rowData = [];
      if (dataMatch) {
        rowData = dataMatch[1].split(',').map(item => item.trim());
      }

      const newRowIndex = worksheet.getRowCount() + 1;
      worksheet.insertRow(newRowIndex);
      
      if (rowData.length > 0) {
        rowData.forEach((value, index) => {
          const cell = worksheet.getCell(newRowIndex, index + 1);
          cell.value = value;
        });
        modifications.push(`إضافة صف جديد: ${rowData.join(', ')}`);
      } else {
        modifications.push(`إضافة صف فارغ`);
      }
    }

    // ============================================================
    // 4️⃣ استبدال النصوص
    // ============================================================
    if (instructionLower.includes('استبدال') || instructionLower.includes('تغيير') || 
        instructionLower.includes('تعديل')) {
      
      const fromMatch = instruction.match(/من\s*["']?([^"'\s,،]+)["']?\s*إلى\s*["']?([^"'\s,،]+)["']?/i);
      
      if (fromMatch) {
        const oldValue = fromMatch[1];
        const newValue = fromMatch[2];
        let modifiedCount = 0;

        const rowCount = worksheet.getRowCount();
        const colCount = worksheet.getColumnCount();
        
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
    // 5️⃣ تغيير اسم عمود
    // ============================================================
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

    // ============================================================
    // 6️⃣ إضافة جدول محوري (Pivot Table) - الميزة الجديدة
    // ============================================================
    if (instructionLower.includes('جدول محوري') || instructionLower.includes('pivot')) {
      // نبحث عن نطاق البيانات
      const rowCount = worksheet.getRowCount();
      const colCount = worksheet.getColumnCount();
      const sourceRange = `A1:${String.fromCharCode(64 + colCount)}${rowCount}`;
      
      // إضافة جدول محوري
      const pivotSheet = workbook.addWorksheet('PivotTable');
      workbook.addPivotTable({
        sourceSheet: worksheet.name,
        sourceRange: sourceRange,
        targetSheet: pivotSheet.name,
        anchorCell: 'A3',
        layout: {
          rows: [{ name: worksheet.getCell(3, 2).value }], // العمود الثاني (اسم الموظف)
          cols: [{ name: worksheet.getCell(3, 1).value }], // العمود الأول (رقم الموظف)
          values: [{ 
            name: worksheet.getCell(3, 9).value, // عمود الحضور
            agg: 'sum',
            displayName: 'إجمالي الحضور'
          }]
        }
      });
      
      modifications.push(`إضافة جدول محوري باستخدام النطاق ${sourceRange}`);
    }

    // ============================================================
    // 7️⃣ حفظ الملف
    // ============================================================
    const outputBuffer = await workbook.writeToBuffer();

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
