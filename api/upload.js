import formidable from "formidable";
import { readFileSync } from "fs";
import xlsx from "xlsx";

export const config = {
  api: {
    bodyParser: false
  }
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const form = formidable();

  form.parse(req, (err, fields, files) => {
    if (err) {
      return res.status(500).json({ error: "فشل رفع الملف" });
    }

    const file = files.file;
    const buffer = readFileSync(file.filepath);

    const workbook = xlsx.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const json = xlsx.utils.sheet_to_json(sheet);

    return res.status(200).json({
      content: json
    });
  });
}
