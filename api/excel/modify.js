import ExcelJS from "exceljs";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { base64, instruction } = req.body;

    if (!base64 || !instruction) {
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

    // نبحث عن صف الهيدر (عادة الصف الثاني)
    const headerRow = sheet.getRow(2);

    // تحديد مكان العمود الجديد
    let insertIndex = sheet.columnCount + 1;
    let newHeaderName = "عمود جديد";

    // إذا طلب المستخدم "سبب الغياب"
    if (instruction.includes("سبب الغياب")) {
      newHeaderName = "سبب الغياب";

      for (let col = 1; col <= sheet.columnCount; col++) {
        const cellValue = headerRow.getCell(col).value;
        if (cellValue === "الغياب") {
          insertIndex = col + 1;
          break;
        }
      }
    }

    // إضافة العمود الجديد
    sheet.spliceColumns(insertIndex, 0, []);

    // كتابة الهيدر
    sheet.getRow(2).getCell(insertIndex).value = newHeaderName;

    // تعبئة الصفوف بقيمة افتراضية
    for (let r = 3; r <= sheet.rowCount; r++) {
      const cell = sheet.getRow(r).getCell(insertIndex);
      if (!cell.value) cell.value = "—";
    }

    // إخراج الملف المعدّل
    const outBuffer = await workbook.xlsx.writeBuffer();

    res.setHeader("Content-Disposition", "attachment; filename=modified.xlsx");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    return res.status(200).send(outBuffer);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
      }
