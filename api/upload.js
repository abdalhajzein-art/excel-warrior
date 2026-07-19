import xlsx from "xlsx";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { data } = req.body;

    if (!data) {
      return res.status(400).json({ error: "لا يوجد بيانات ملف" });
    }

    const buffer = Buffer.from(data, "base64");

    const workbook = xlsx.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const json = xlsx.utils.sheet_to_json(sheet);

    return res.status(200).json({
      content: json
    });

  } catch (err) {
    return res.status(500).json({
      error: "فشل قراءة الملف: " + err.message
    });
  }
}
