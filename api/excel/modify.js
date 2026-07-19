import ExcelJS from "exceljs";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { base64, editMap } = req.body;

    if (!base64 || !editMap) {
      return res.status(400).json({ error: "البيانات غير كاملة" });
    }

    // فك Base64 إلى Buffer
    const buffer = Buffer.from(base64, "base64");

    // قراءة ملف Excel الحقيقي
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    // نفترض أول ورقة هي المستهدفة
    const sheet = workbook.worksheets[0];
    if (!sheet) {
      return res.status(400).json({ error: "لا يوجد ورقة عمل في الملف" });
    }

    /* -------------------------------------------------------
       1) إضافة عمود جديد
------------------------------------------------------- */
    if (editMap.action === "add_column") {
      const { headerName, positionAfter } = editMap;

      const headerRow = sheet.getRow(2);
      let insertIndex = sheet.columnCount + 1;

      // إذا بدنا نضيف العمود بعد عمود معيّن
      if (positionAfter) {
        for (let col = 1; col <= sheet.columnCount; col++) {
          const cellValue = headerRow.getCell(col).value;
          if (cellValue === positionAfter) {
            insertIndex = col + 1;
            break;
          }
        }
      }

      // إضافة العمود
      sheet.spliceColumns(insertIndex, 0, []);

      // كتابة الهيدر
      sheet.getRow(2).getCell(insertIndex).value = headerName;

      // تعبئة الصفوف بقيمة افتراضية
      for (let r = 3; r <= sheet.rowCount; r++) {
        const cell = sheet.getRow(r).getCell(insertIndex);
        if (!cell.value) cell.value = editMap.defaultValue || "—";
      }
    }

    /* -------------------------------------------------------
       2) تعديل صف معيّن
------------------------------------------------------- */
    if (editMap.action === "modify_row") {
      const { rowNumber, updates } = editMap;

      const row = sheet.getRow(rowNumber);
      if (!row) {
        return res.status(400).json({ error: "الصف المطلوب غير موجود" });
      }

      Object.keys(updates).forEach((colName) => {
        const headerRow = sheet.getRow(2);

        let colIndex = null;
        for (let col = 1; col <= sheet.columnCount; col++) {
          if (headerRow.getCell(col).value === colName) {
            colIndex = col;
            break;
          }
        }

        if (colIndex) {
          row.getCell(colIndex).value = updates[colName];
        }
      });

      row.commit();
    }

    /* -------------------------------------------------------
       3) حذف عمود
------------------------------------------------------- */
    if (editMap.action === "delete_column") {
      const { columnName } = editMap;

      const headerRow = sheet.getRow(2);
      let deleteIndex = null;

      for (let col = 1; col <= sheet.columnCount; col++) {
        if (headerRow.getCell(col).value === columnName) {
          deleteIndex = col;
          break;
        }
      }

      if (deleteIndex) {
        sheet.spliceColumns(deleteIndex, 1);
      }
    }

    /* -------------------------------------------------------
       4) تعديل صيغة
------------------------------------------------------- */
    if (editMap.action === "modify_formula") {
      const { columnName, newFormula } = editMap;

      const headerRow = sheet.getRow(2);
      let colIndex = null;

      for (let col = 1; col <= sheet.columnCount; col++) {
        if (headerRow.getCell(col).value === columnName) {
          colIndex = col;
          break;
        }
      }

      if (colIndex) {
        for (let r = 3; r <= sheet.rowCount; r++) {
          const cell = sheet.getRow(r).getCell(colIndex);
          cell.value = { formula: newFormula };
        }
      }
    }

    /* -------------------------------------------------------
       إخراج الملف المعدّل
------------------------------------------------------- */
    const outBuffer = await workbook.xlsx.writeBuffer();

    res.setHeader("Content-Disposition", "attachment; filename=modified.xlsx");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    return res.status(200).send(outBuffer);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
        }
