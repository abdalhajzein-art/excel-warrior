// api/word/generate.js
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { title, content } = body || {};

    if (!title || !content) {
      return res.status(400).json({ error: "العنوان والمحتوى مطلوبان لتوليد المستند." });
    }

    // بناء المستند بهيكلية وستايل احترافي
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            text: title,
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: content,
                size: 28, // حجم الخط 14pt
                font: "Segoe UI", // خط عصري ومناسب للغة العربية
              }),
            ],
            alignment: AlignmentType.JUSTIFIED,
            spacing: { line: 360 }, // تباعد الأسطر لسهولة القراءة
          }),
        ],
      }],
    });

    const buffer = await Packer.toBuffer(doc);

    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(title)}.docx"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");

    return res.status(200).send(Buffer.from(buffer));

  } catch (err) {
    console.error("Error generating Word doc:", err);
    return res.status(500).json({ error: "خطأ في التوليد: " + err.message });
  }
}

export async function generateWordHandler(payload) {
  return { status: "success", message: "تم تحضير أمر توليد الوورد" };
}
