import { Workbook } from '@office-kit/xlsx';

// ✅ دالة للتحقق من إصدار المكتبة
async function checkLibraryVersion() {
  try {
    const { version } = await import('@office-kit/xlsx/package.json');
    const [major, minor, patch] = version.split('.').map(Number);
    if (major < 1) {
      return {
        isOutdated: true,
        message: `⚠️ المكتبة في نسخة تجريبية (v${version}). يرجى التحديث إلى v1.0.0 أو أحدث.`
      };
    }
    return { isOutdated: false };
  } catch (err) {
    return {
      isOutdated: true,
      message: `❌ تعذّر قراءة إصدار المكتبة. يرجى إعادة تثبيت @office-kit/xlsx.`
    };
  }
}

export async function modifyExcelHandler(req, res) {
  try {
    // ✅ التحقق من الإصدار أولاً
    const versionCheck = await checkLibraryVersion();
    if (versionCheck.isOutdated) {
      return {
        success: false,
        error: versionCheck.message
      };
    }

    const body = req.body || req || {};
    const { base64, instruction } = body;

    console.log(`📝 modifyExcelHandler: base64 موجود؟ ${!!base64}`);
    console.log(`📝 instruction: ${instruction}`);

    if (!base64) {
      return { success: false, error: "لا يوجد ملف Excel مرفق." };
    }

    const buffer = Buffer.from(base64, 'base64');
    const workbook = new Workbook();
    await workbook.loadFromBuffer(buffer);
    
    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      return { success: false, error: "لا يوجد ورقة عمل في الملف." };
    }

    const instructionLower = (instruction || "").toLowerCase();
    let modifications = [];

    // ============================================================
    // 1️⃣ إدارة الأعمدة (Columns)
    // ============================================================

    // 1.1 إضافة عمود
    if (instructionLower.includes('إضافة عمود') || instructionLower.includes('اضافة عمود') || 
        instructionLower.includes('ضيف عمود') || instructionLower.includes('أضف عمود')) {
      
      let newColumnName = 'عمود جديد';
      const nameMatch = instruction.match(/["']([^"']+)["']/);
      if (nameMatch) newColumnName = nameMatch[1];
      else {
        const nameAfter = instruction.match(/اسمه\s*([^\s,،]+)/i);
        if (nameAfter) newColumnName = nameAfter[1];
      }

      let targetColumnName = null;
      const afterMatch = instruction.match(/بعد\s*["']?([^"'\s,،]+)["']?/i);
      const beforeMatch = instruction.match(/قبل\s*["']?([^"'\s,،]+)["']?/i);
      
      if (afterMatch) targetColumnName = afterMatch[1];
      else if (beforeMatch) targetColumnName = beforeMatch[1];

      let targetColumnIndex = -1;
      const headerRow = worksheet.getRow(3);
      
      if (targetColumnName) {
        headerRow.eachCell((cell, colNumber) => {
          if (cell.value && cell.value.toString().toLowerCase().includes(targetColumnName.toLowerCase())) {
            targetColumnIndex = colNumber;
          }
        });
      }

      if (targetColumnIndex === -1) targetColumnIndex = worksheet.getColumnCount();

      let insertIndex;
      if (afterMatch && targetColumnIndex !== -1) insertIndex = targetColumnIndex + 1;
      else if (beforeMatch && targetColumnIndex !== -1) insertIndex = targetColumnIndex;
      else insertIndex = worksheet.getColumnCount() + 1;

      worksheet.insertColumn(insertIndex);
      const rowCount = worksheet.getRowCount();
      for (let i = 1; i <= rowCount; i++) {
        const cell = worksheet.getCell(i, insertIndex);
        if (i === 3) cell.value = newColumnName;
        else cell.value = '';
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
          worksheet.deleteColumn(deleteIndex);
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
          const newIndex = worksheet.getColumnCount() + 1;
          worksheet.insertColumn(newIndex);
          const rowCount = worksheet.getRowCount();
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

    // 1.5 نقل عمود
    if (instructionLower.includes('نقل عمود') || instructionLower.includes('تحريك عمود')) {
      const moveMatch = instruction.match(/نقل\s*["']?([^"'\s,،]+)["']?\s*(?:إلى|قبل|بعد)\s*["']?([^"'\s,،]+)["']?/i);
      if (moveMatch) {
        const colName = moveMatch[1];
        const targetName = moveMatch[2];
        let sourceIndex = -1, targetIndex = -1;
        const headerRow = worksheet.getRow(3);
        headerRow.eachCell((cell, colNumber) => {
          if (cell.value && cell.value.toString().toLowerCase().includes(colName.toLowerCase())) sourceIndex = colNumber;
          if (cell.value && cell.value.toString().toLowerCase().includes(targetName.toLowerCase())) targetIndex = colNumber;
        });
        if (sourceIndex !== -1 && targetIndex !== -1) {
          // استخراج العمود
          const colData = [];
          const rowCount = worksheet.getRowCount();
          for (let i = 1; i <= rowCount; i++) {
            colData.push(worksheet.getCell(i, sourceIndex).value);
          }
          // حذف العمود
          worksheet.deleteColumn(sourceIndex);
          // إعادة إدراجه
          const newIndex = sourceIndex < targetIndex ? targetIndex : targetIndex;
          worksheet.insertColumn(newIndex);
          for (let i = 1; i <= rowCount; i++) {
            worksheet.getCell(i, newIndex).value = colData[i-1];
          }
          modifications.push(`نقل عمود "${colName}"`);
        }
      }
    }

    // 1.6 إخفاء/إظهار عمود
    if (instructionLower.includes('إخفاء عمود') || instructionLower.includes('إظهار عمود')) {
      const colMatch = instruction.match(/(إخفاء|إظهار)\s*["']?([^"'\s,،]+)["']?/i);
      if (colMatch) {
        const action = colMatch[1];
        const colName = colMatch[2];
        let colIndex = -1;
        const headerRow = worksheet.getRow(3);
        headerRow.eachCell((cell, colNumber) => {
          if (cell.value && cell.value.toString().toLowerCase().includes(colName.toLowerCase())) {
            colIndex = colNumber;
          }
        });
        if (colIndex !== -1) {
          const col = worksheet.getColumn(colIndex);
          col.hidden = (action === 'إخفاء');
          modifications.push(`${action} عمود "${colName}"`);
        }
      }
    }

    // 1.7 تعيين عرض عمود
    if (instructionLower.includes('عرض عمود') || instructionLower.includes('توسيع عمود')) {
      const widthMatch = instruction.match(/(\d+)\s*(?:px|نقطة|عرض)/i);
      const colMatch = instruction.match(/عمود\s*["']?([^"'\s,،]+)["']?/i);
      if (widthMatch && colMatch) {
        const width = parseInt(widthMatch[1]);
        const colName = colMatch[1];
        let colIndex = -1;
        const headerRow = worksheet.getRow(3);
        headerRow.eachCell((cell, colNumber) => {
          if (cell.value && cell.value.toString().toLowerCase().includes(colName.toLowerCase())) {
            colIndex = colNumber;
          }
        });
        if (colIndex !== -1) {
          const col = worksheet.getColumn(colIndex);
          col.width = width;
          modifications.push(`تعيين عرض عمود "${colName}" إلى ${width}`);
        }
      }
    }

    // ============================================================
    // 2️⃣ إدارة الصفوف (Rows)
    // ============================================================

    // 2.1 إضافة صف
    if (instructionLower.includes('إضافة صف') || instructionLower.includes('اضافة صف') || 
        instructionLower.includes('ضيف صف') || instructionLower.includes('أضف صف')) {
      
      const dataMatch = instruction.match(/\[([^\]]+)\]/);
      const rowData = dataMatch ? dataMatch[1].split(',').map(item => item.trim()) : [];
      const newRowIndex = worksheet.getRowCount() + 1;
      worksheet.insertRow(newRowIndex);
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
        if (rowNumber > 0 && rowNumber <= worksheet.getRowCount()) {
          worksheet.deleteRow(rowNumber);
          modifications.push(`حذف الصف ${rowNumber}`);
        }
      }
    }

    // 2.3 تكرار صف
    if (instructionLower.includes('تكرار صف') || instructionLower.includes('نسخ صف')) {
      const rowMatch = instruction.match(/(\d+)/);
      if (rowMatch) {
        const rowNumber = parseInt(rowMatch[1]);
        if (rowNumber > 0 && rowNumber <= worksheet.getRowCount()) {
          const newRowIndex = worksheet.getRowCount() + 1;
          worksheet.insertRow(newRowIndex);
          const colCount = worksheet.getColumnCount();
          for (let i = 1; i <= colCount; i++) {
            worksheet.getCell(newRowIndex, i).value = worksheet.getCell(rowNumber, i).value;
          }
          modifications.push(`تكرار الصف ${rowNumber}`);
        }
      }
    }

    // 2.4 إخفاء/إظهار صف
    if (instructionLower.includes('إخفاء صف') || instructionLower.includes('إظهار صف')) {
      const rowMatch = instruction.match(/(\d+)/);
      if (rowMatch) {
        const rowNumber = parseInt(rowMatch[1]);
        if (rowNumber > 0 && rowNumber <= worksheet.getRowCount()) {
          const row = worksheet.getRow(rowNumber);
          row.hidden = instructionLower.includes('إخفاء');
          modifications.push(`${instructionLower.includes('إخفاء') ? 'إخفاء' : 'إظهار'} الصف ${rowNumber}`);
        }
      }
    }

    // 2.5 تعيين ارتفاع صف
    if (instructionLower.includes('ارتفاع صف') || instructionLower.includes('تكبير صف')) {
      const heightMatch = instruction.match(/(\d+)\s*(?:pt|نقطة)/i);
      const rowMatch = instruction.match(/(\d+)/);
      if (heightMatch && rowMatch) {
        const height = parseInt(heightMatch[1]);
        const rowNumber = parseInt(rowMatch[1]);
        if (rowNumber > 0 && rowNumber <= worksheet.getRowCount()) {
          const row = worksheet.getRow(rowNumber);
          row.height = height;
          modifications.push(`تعيين ارتفاع الصف ${rowNumber} إلى ${height}pt`);
        }
      }
    }

    // ============================================================
    // 3️⃣ تعديل البيانات (Data)
    // ============================================================

    // 3.1 استبدال النصوص
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

    // 3.2 تعبئة عمود بقيمة
    if (instructionLower.includes('تعبئة عمود') || instructionLower.includes('ملء عمود')) {
      const colMatch = instruction.match(/تعبئة\s*["']?([^"'\s,،]+)["']?\s*بقيمة\s*["']?([^"'\s,،]+)["']?/i);
      if (colMatch) {
        const colName = colMatch[1];
        const value = colMatch[2];
        let colIndex = -1;
        const headerRow = worksheet.getRow(3);
        headerRow.eachCell((cell, colNumber) => {
          if (cell.value && cell.value.toString().toLowerCase().includes(colName.toLowerCase())) {
            colIndex = colNumber;
          }
        });
        if (colIndex !== -1) {
          const rowCount = worksheet.getRowCount();
          for (let i = 4; i <= rowCount; i++) {
            worksheet.getCell(i, colIndex).value = value;
          }
          modifications.push(`تعبئة عمود "${colName}" بقيمة "${value}"`);
        }
      }
    }

    // 3.3 تعبئة صف بقيمة
    if (instructionLower.includes('تعبئة صف') || instructionLower.includes('ملء صف')) {
      const rowMatch = instruction.match(/(\d+)/);
      const valueMatch = instruction.match(/بقيمة\s*["']?([^"'\s,،]+)["']?/i);
      if (rowMatch && valueMatch) {
        const rowNumber = parseInt(rowMatch[1]);
        const value = valueMatch[1];
        if (rowNumber > 0 && rowNumber <= worksheet.getRowCount()) {
          const colCount = worksheet.getColumnCount();
          for (let i = 1; i <= colCount; i++) {
            worksheet.getCell(rowNumber, i).value = value;
          }
          modifications.push(`تعبئة الصف ${rowNumber} بقيمة "${value}"`);
        }
      }
    }

    // 3.4 تطبيق صيغة على عمود
    if (instructionLower.includes('صيغة') || instructionLower.includes('formula')) {
      const formulaMatch = instruction.match(/صيغة\s*["']?([^"'\s,،]+)["']?\s*[:=]\s*["']?([^"'\s,،]+)["']?/i);
      if (formulaMatch) {
        const colName = formulaMatch[1];
        const formula = formulaMatch[2];
        let colIndex = -1;
        const headerRow = worksheet.getRow(3);
        headerRow.eachCell((cell, colNumber) => {
          if (cell.value && cell.value.toString().toLowerCase().includes(colName.toLowerCase())) {
            colIndex = colNumber;
          }
        });
        if (colIndex !== -1) {
          const rowCount = worksheet.getRowCount();
          for (let i = 4; i <= rowCount; i++) {
            const cell = worksheet.getCell(i, colIndex);
            cell.value = { formula: formula.replace('ROW', i) };
          }
          modifications.push(`تطبيق صيغة على عمود "${colName}"`);
        }
      }
    }

    // 3.5 تطبيق صيغة على خلية محددة
    if (instructionLower.includes('صيغة في') && !instructionLower.includes('عمود')) {
      const cellMatch = instruction.match(/([A-Z]+\d+)/i);
      const formulaMatch = instruction.match(/[:=]\s*["']?([^"'\s,،]+)["']?/i);
      if (cellMatch && formulaMatch) {
        const cellRef = cellMatch[1];
        const formula = formulaMatch[1];
        const cell = worksheet.getCell(cellRef);
        cell.value = { formula: formula };
        modifications.push(`تطبيق صيغة في الخلية ${cellRef}: ${formula}`);
      }
    }

    // ============================================================
    // 4️⃣ التنسيق (Formatting)
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
          const rowCount = worksheet.getRowCount();
          for (let i = 1; i <= rowCount; i++) {
            const cell = worksheet.getCell(i, colIndex);
            cell.fill = { type: 'solid', color: color };
          }
          modifications.push(`تغيير لون عمود "${colName}" إلى ${color}`);
        }
      }
    }

    // 4.2 تغيير لون خلفية خلية محددة
    if (instructionLower.includes('لون خلية') && !instructionLower.includes('عمود')) {
      const cellMatch = instruction.match(/([A-Z]+\d+)/i);
      const colorMatch = instruction.match(/(#[0-9A-Fa-f]{6})|(أحمر|أزرق|أخضر|أصفر|أسود|أبيض)/i);
      if (cellMatch && colorMatch) {
        const cellRef = cellMatch[1];
        let color = colorMatch[1] || colorMatch[2];
        const cell = worksheet.getCell(cellRef);
        cell.fill = { type: 'solid', color: color };
        modifications.push(`تغيير لون الخلية ${cellRef} إلى ${color}`);
      }
    }

    // 4.3 تغيير لون النص
    if (instructionLower.includes('لون نص') || instructionLower.includes('لون الخط')) {
      const colorMatch = instruction.match(/(#[0-9A-Fa-f]{6})|(أحمر|أزرق|أخضر|أصفر|أسود|أبيض)/i);
      const cellMatch = instruction.match(/([A-Z]+\d+)/i);
      if (colorMatch) {
        let color = colorMatch[1] || colorMatch[2];
        if (cellMatch) {
          const cellRef = cellMatch[1];
          const cell = worksheet.getCell(cellRef);
          cell.font = { color: color };
          modifications.push(`تغيير لون نص الخلية ${cellRef} إلى ${color}`);
        } else {
          const rowCount = worksheet.getRowCount();
          const colCount = worksheet.getColumnCount();
          for (let i = 1; i <= rowCount; i++) {
            for (let j = 1; j <= colCount; j++) {
              const cell = worksheet.getCell(i, j);
              cell.font = { color: color };
            }
          }
          modifications.push(`تغيير لون النص في جميع الخلايا إلى ${color}`);
        }
      }
    }

    // 4.4 تغيير حجم الخط
    if (instructionLower.includes('حجم خط') || instructionLower.includes('تكبير خط')) {
      const sizeMatch = instruction.match(/(\d+)\s*(?:pt|px|نقطة)/i);
      if (sizeMatch) {
        const size = parseInt(sizeMatch[1]);
        const rowCount = worksheet.getRowCount();
        const colCount = worksheet.getColumnCount();
        for (let i = 1; i <= rowCount; i++) {
          for (let j = 1; j <= colCount; j++) {
            const cell = worksheet.getCell(i, j);
            if (cell.font) cell.font.size = size;
            else cell.font = { size: size };
          }
        }
        modifications.push(`تغيير حجم الخط إلى ${size}pt`);
      }
    }

    // 4.5 تغيير نوع الخط
    if (instructionLower.includes('نوع خط') || instructionLower.includes('تغيير الخط')) {
      const fontMatch = instruction.match(/خط\s*["']?([^"'\s,،]+)["']?/i);
      if (fontMatch) {
        const fontName = fontMatch[1];
        const rowCount = worksheet.getRowCount();
        const colCount = worksheet.getColumnCount();
        for (let i = 1; i <= rowCount; i++) {
          for (let j = 1; j <= colCount; j++) {
            const cell = worksheet.getCell(i, j);
            if (cell.font) cell.font.name = fontName;
            else cell.font = { name: fontName };
          }
        }
        modifications.push(`تغيير نوع الخط إلى "${fontName}"`);
      }
    }

    // 4.6 جعل النص عريض (Bold)
    if (instructionLower.includes('عريض') || instructionLower.includes('bold') || 
        instructionLower.includes('تثخين')) {
      const rowCount = worksheet.getRowCount();
      const colCount = worksheet.getColumnCount();
      for (let i = 1; i <= rowCount; i++) {
        for (let j = 1; j <= colCount; j++) {
          const cell = worksheet.getCell(i, j);
          if (cell.font) cell.font.bold = true;
          else cell.font = { bold: true };
        }
      }
      modifications.push(`تطبيق الخط العريض على جميع الخلايا`);
    }

    // 4.7 إضافة حدود
    if (instructionLower.includes('حدود') || instructionLower.includes('border')) {
      const rowCount = worksheet.getRowCount();
      const colCount = worksheet.getColumnCount();
      for (let i = 1; i <= rowCount; i++) {
        for (let j = 1; j <= colCount; j++) {
          const cell = worksheet.getCell(i, j);
          cell.border = {
            top: { style: 'thin' },
            bottom: { style: 'thin' },
            left: { style: 'thin' },
            right: { style: 'thin' }
          };
        }
      }
      modifications.push(`إضافة حدود لجميع الخلايا`);
    }

    // 4.8 محاذاة النص
    if (instructionLower.includes('محاذاة') || instructionLower.includes('align')) {
      const alignMatch = instruction.match(/(يمين|يسار|وسط|justify)/i);
      if (alignMatch) {
        const align = alignMatch[1];
        const alignmentMap = { 'يمين': 'right', 'يسار': 'left', 'وسط': 'center', 'justify': 'justify' };
        const alignment = alignmentMap[align] || 'center';
        const rowCount = worksheet.getRowCount();
        const colCount = worksheet.getColumnCount();
        for (let i = 1; i <= rowCount; i++) {
          for (let j = 1; j <= colCount; j++) {
            const cell = worksheet.getCell(i, j);
            cell.alignment = { horizontal: alignment };
          }
        }
        modifications.push(`محاذاة النص إلى ${align}`);
      }
    }

    // ============================================================
    // 5️⃣ العمليات المتقدمة (Advanced)
    // ============================================================

    // 5.1 دمج خلايا
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

    // 5.2 إضافة تعليق
    if (instructionLower.includes('تعليق') || instructionLower.includes('ملاحظة')) {
      const commentMatch = instruction.match(/تعليق\s*["']([^"']+)["']/i);
      if (commentMatch) {
        const commentText = commentMatch[1];
        const cellMatch = instruction.match(/([A-Z]+\d+)/i);
        const targetCell = cellMatch ? worksheet.getCell(cellMatch[1]) : worksheet.getCell('A1');
        targetCell.comment = { text: commentText };
        modifications.push(`إضافة تعليق: "${commentText}"`);
      }
    }

    // 5.3 إضافة جدول محوري (Pivot Table)
    if (instructionLower.includes('جدول محوري') || instructionLower.includes('pivot')) {
      const rowCount = worksheet.getRowCount();
      const colCount = worksheet.getColumnCount();
      const sourceRange = `A1:${String.fromCharCode(64 + colCount)}${rowCount}`;
      
      const pivotSheet = workbook.addWorksheet('PivotTable');
      workbook.addPivotTable({
        sourceSheet: worksheet.name,
        sourceRange: sourceRange,
        targetSheet: pivotSheet.name,
        anchorCell: 'A3',
        layout: {
          rows: [{ name: worksheet.getCell(3, 2).value || 'الصفوف' }],
          cols: [{ name: worksheet.getCell(3, 1).value || 'الأعمدة' }],
          values: [{ 
            name: worksheet.getCell(3, worksheet.getColumnCount()).value || 'القيم',
            agg: 'sum',
            displayName: 'الإجمالي'
          }]
        }
      });
      modifications.push(`إضافة جدول محوري باستخدام النطاق ${sourceRange}`);
    }

    // 5.4 إضافة تصفية (Filter)
    if (instructionLower.includes('تصفية') || instructionLower.includes('filter')) {
      const rowCount = worksheet.getRowCount();
      const colCount = worksheet.getColumnCount();
      worksheet.autoFilter = {
        from: 'A1',
        to: `${String.fromCharCode(64 + colCount)}${rowCount}`
      };
      modifications.push(`إضافة تصفية على النطاق A1:${String.fromCharCode(64 + colCount)}${rowCount}`);
    }

    // 5.5 حماية ورقة العمل
    if (instructionLower.includes('حماية') || instructionLower.includes('protect')) {
      const passwordMatch = instruction.match(/بكلمة\s*["']?([^"'\s,،]+)["']?/i);
      const password = passwordMatch ? passwordMatch[1] : '';
      worksheet.protect = { password: password };
      modifications.push(`حماية ورقة العمل${password ? ' بكلمة مرور' : ''}`);
    }

    // 5.6 إلغاء حماية ورقة العمل
    if (instructionLower.includes('إلغاء حماية') || instructionLower.includes('unprotect')) {
      worksheet.protect = false;
      modifications.push(`إلغاء حماية ورقة العمل`);
    }

    // 5.7 إضافة مخطط (Chart)
    if (instructionLower.includes('مخطط') || instructionLower.includes('chart')) {
      const chartType = instructionLower.includes('دائري') ? 'pie' :
                        instructionLower.includes('خطي') ? 'line' :
                        instructionLower.includes('شريطي') ? 'bar' : 'column';
      
      const rowCount = worksheet.getRowCount();
      const colCount = worksheet.getColumnCount();
      const dataRange = `A1:${String.fromCharCode(64 + colCount)}${rowCount}`;
      
      // إضافة مخطط في ورقة جديدة
      const chartSheet = workbook.addWorksheet('Chart');
      workbook.addChart({
        type: chartType,
        dataSheet: worksheet.name,
        dataRange: dataRange,
        targetSheet: chartSheet.name,
        anchorCell: 'A1',
        title: 'مخطط البيانات'
      });
      modifications.push(`إضافة مخطط من نوع "${chartType}" باستخدام النطاق ${dataRange}`);
    }

    // 5.8 فرز البيانات
    if (instructionLower.includes('فرز') || instructionLower.includes('sort')) {
      const colMatch = instruction.match(/حسب\s*["']?([^"'\s,،]+)["']?/i);
      if (colMatch) {
        const sortCol = colMatch[1];
        let sortIndex = -1;
        const headerRow = worksheet.getRow(3);
        headerRow.eachCell((cell, colNumber) => {
          if (cell.value && cell.value.toString().toLowerCase().includes(sortCol.toLowerCase())) {
            sortIndex = colNumber;
          }
        });
        if (sortIndex !== -1) {
          const rowCount = worksheet.getRowCount();
          const data = [];
          for (let i = 4; i <= rowCount; i++) {
            const row = [];
            for (let j = 1; j <= worksheet.getColumnCount(); j++) {
              row.push(worksheet.getCell(i, j).value);
            }
            data.push({ row: row, sortValue: worksheet.getCell(i, sortIndex).value });
          }
          data.sort((a, b) => (a.sortValue || '').localeCompare(b.sortValue || ''));
          for (let i = 0; i < data.length; i++) {
            for (let j = 1; j <= worksheet.getColumnCount(); j++) {
              worksheet.getCell(i + 4, j).value = data[i].row[j - 1];
            }
          }
          modifications.push(`فرز البيانات حسب عمود "${sortCol}"`);
        }
      }
    }

    // 5.9 إزالة التكرارات
    if (instructionLower.includes('إزالة التكرارات') || instructionLower.includes('remove duplicates')) {
      const colMatch = instruction.match(/حسب\s*["']?([^"'\s,،]+)["']?/i);
      if (colMatch) {
        const dedupCol = colMatch[1];
        let dedupIndex = -1;
        const headerRow = worksheet.getRow(3);
        headerRow.eachCell((cell, colNumber) => {
          if (cell.value && cell.value.toString().toLowerCase().includes(dedupCol.toLowerCase())) {
            dedupIndex = colNumber;
          }
        });
        if (dedupIndex !== -1) {
          const rowCount = worksheet.getRowCount();
          const seen = new Set();
          let deletedCount = 0;
          for (let i = 4; i <= rowCount; i++) {
            const value = worksheet.getCell(i, dedupIndex).value;
            if (seen.has(value)) {
              worksheet.deleteRow(i);
              deletedCount++;
              i--;
            } else {
              seen.add(value);
            }
          }
          modifications.push(`إزالة ${deletedCount} تكرار حسب عمود "${dedupCol}"`);
        }
      }
    }

    // 5.10 تحويل إلى CSV (تصدير)
    if (instructionLower.includes('تحويل إلى csv') || instructionLower.includes('تصدير csv')) {
      let csvData = [];
      const rowCount = worksheet.getRowCount();
      const colCount = worksheet.getColumnCount();
      for (let i = 1; i <= rowCount; i++) {
        const rowData = [];
        for (let j = 1; j <= colCount; j++) {
          rowData.push(worksheet.getCell(i, j).value || '');
        }
        csvData.push(rowData.join(','));
      }
      const csvString = csvData.join('\n');
      return {
        success: true,
        message: "✅ تم تحويل الملف إلى CSV",
        fileBase64: Buffer.from(csvString).toString('base64'),
        fileName: `converted_${Date.now()}.csv`,
        contentType: 'text/csv'
      };
    }

    // ============================================================
    // حفظ الملف
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
    
    // ✅ إذا كان الخطأ بسبب عدم توافق الإصدار
    if (error.message.includes('version') || error.message.includes('unsupported') || error.message.includes('import')) {
      return {
        success: false,
        error: `⚠️ تعذّرت العملية بسبب قدم إصدار المكتبة. يرجى تحديث @office-kit/xlsx إلى آخر إصدار.`
      };
    }
    
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
