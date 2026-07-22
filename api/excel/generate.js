import xlsx from "xlsx";

export async function generateExcelHandler(payload) {
  const { instruction } = payload || {};
  
  // ✅ توليد جدول افتراضي إذا ما في تعليمات
  let jsonData = [
    { "العمود 1": "قيمة 1", "العمود 2": "قيمة 2", "العمود 3": "قيمة 3" },
    { "العمود 1": "قيمة 4", "العمود 2": "قيمة 5", "العمود 3": "قيمة 6" },
    { "العمود 1": "قيمة 7", "العمود 2": "قيمة 8", "العمود 3": "قيمة 9" }
  ];

  // ✅ إذا في تعليمات، نحاول نستخرج منها بيانات (تطوير مستقبلي)
  if (instruction) {
    // هنا نقدر نضيف منطق لتحليل النص واستخراج البيانات
    // حالياً نستخدم البيانات الافتراضية
  }

  const worksheet = xlsx.utils.json_to_sheet(jsonData);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, "Sheet1");

  const buffer = xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });
  return Buffer.from(buffer);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const bufferResult = await generateExcelHandler(body);

    res.setHeader("Content-Disposition", "attachment; filename=generated.xlsx");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    return res.status(200).send(bufferResult);

  } catch (err) {
    console.error("Error in generate excel:", err);
    return res.status(500).json({ error: "خطأ في التوليد: " + err.message });
  }
}
