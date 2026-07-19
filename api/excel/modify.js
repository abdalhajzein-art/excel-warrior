import ExcelJS from "exceljs";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { content, instruction } = req.body;

    if (!content || !instruction) {
      return res.status(400).json({ error: "البيانات غير كاملة" });
    }

    // إنشاء ملف جديد من البيانات
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Sheet1");

    // كتابة البيانات للورقة
    content.forEach((row) => {
      sheet.addRow(Object.values(row));
    });

    // تنفيذ التعديل النهائي
    // مثال: إضافة عمود جديد
    if (instruction.includes("سبب الطرد")) {
      sheet.insertColumn(sheet.columnCount + 1, ["سبب الطرد"]);
    }

    // إخراج الملف
    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader("Content-Disposition", "attachment; filename=modified.xlsx");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    return res.status(200).send(buffer);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
