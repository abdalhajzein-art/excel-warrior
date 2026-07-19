export const config = {
  api: {
    bodyParser: true
  }
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { filename, data } = req.body;

    if (!data) {
      return res.status(400).json({ error: "لا يوجد بيانات ملف" });
    }

    // هون ما منحوّل الملف لـ JSON نهائياً
    // فقط نرجّع الـ Base64 كما هو
    // لأن التعديل الحقيقي رح يصير داخل /api/excel/modify.js باستخدام ExcelJS

    return res.status(200).json({
      filename,
      base64: data
    });

  } catch (err) {
    return res.status(500).json({
      error: "فشل قراءة الملف: " + err.message
    });
  }
}
