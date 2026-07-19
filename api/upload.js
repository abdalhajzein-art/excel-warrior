import xlsx from "xlsx";

export const config = {
  api: {
    bodyParser: false
  }
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }

    const buffer = Buffer.concat(chunks);

    // قراءة ملف Excel من البفر
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
