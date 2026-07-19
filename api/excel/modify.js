import ExcelJS from "exceljs";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { content, instruction } = req.body;

    if (!content || !instruction) {
      return res.status(400).json({ error: "البيانات غير كاملة" });
    }

    // نعتبر:
    // row[0] = صف تعليمي (إن وجد)
    // row[1] = هيدر (عناوين الأعمدة)
    // باقي الصفوف = بيانات
    const rows = Array.isArray(content) ? content : [];

    if (rows.length === 0) {
      return res.status(400).json({ error: "لا يوجد صفوف في الملف" });
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Sheet1");

    // نحافظ على ترتيب المفاتيح كما رجعت من xlsx
    const keys = Object.keys(rows[1] || rows[0]);

    // 1) نكتب الصف التعليمي إن وجد
    sheet.addRow(keys.map(k => rows[0][k] ?? ""));

    // 2) نكتب صف الهيدر (عناوين الأعمدة)
    const headerRowObj = rows[1] || rows[0];
    const headerRow = keys.map(k => headerRowObj[k] ?? "");
    sheet.addRow(headerRow);

    // 3) نكتب باقي البيانات
    for (let i = 2; i < rows.length; i++) {
      const rowObj = rows[i];
      const rowValues = keys.map(k => rowObj[k] ?? "");
      sheet.addRow(rowValues);
    }

    // الآن: نضيف عمود جديد بشكل عام
    // إذا المستخدم طلب "سبب الغياب" نحاول نضيفه بعد عمود "الغياب" إن وجد
    let insertIndex = sheet.columnCount + 1;
    let newHeaderName = "عمود جديد";

    if (instruction.includes("سبب الغياب")) {
      newHeaderName = "سبب الغياب";

      // نحاول نلاقي عمود "الغياب" في صف الهيدر
      const headerRowExcel = sheet.getRow(2); // الصف الثاني هو الهيدر
      for (let col = 1; col <= sheet.columnCount; col++) {
        const cellValue = headerRowExcel.getCell(col).value;
        if (cellValue === "الغياب") {
          insertIndex = col + 1;
          break;
        }
      }
    } else {
      // لو طلب المستخدم إضافة عمود بشكل عام (مثلاً "ضيفلي عمود ...")
      // نضيفه في آخر الأعمدة
      insertIndex = sheet.columnCount + 1;
      newHeaderName = "عمود جديد";
    }

    // نضيف العمود الجديد
    sheet.insertColumn(insertIndex, []);

    // نكتب الهيدر للعمود الجديد
    sheet.getRow(2).getCell(insertIndex).value = newHeaderName;

    // نملأ القيم الافتراضية للصفوف (مثلاً "—")
    for (let r = 3; r <= sheet.rowCount; r++) {
      sheet.getRow(r).getCell(insertIndex).value = "—";
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
