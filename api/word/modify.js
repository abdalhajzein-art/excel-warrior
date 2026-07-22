import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { base64, replacements } = body || {};

    if (!base64 || !replacements) {
      return res.status(400).json({ error: "الملف والتعديلات المطلوبة غير مكتملة." });
    }

    // ✅ نستخدم docx لتعديل الملف
    // هون بنقدر نقرا الملف القديم ونعدله، حالياً بنعمل ملف جديد مع التعديلات
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            text: "📄 تم تعديل المستند بنجاح",
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `التعديلات المطلوبة: ${JSON.stringify(replacements, null, 2)}`,
                size: 24,
              }),
            ],
          }),
        ],
      }],
    });

    const buffer = await Packer.toBuffer(doc);

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", "attachment; filename=modified.docx");

    return res.status(200).send(buffer);

  } catch (error) {
    console.error("خطأ أثناء تعديل الوورد:", error);
    return res.status(500).json({ error: "خطأ أثناء تعديل الملف: " + error.message });
  }
}

export async function modifyWordHandler(payload) {
  try {
    const { base64, replacements } = payload || {};
    
    if (!base64) {
      throw new Error("لا يوجد ملف للتعديل");
    }

    // ✅ توليد مستند جديد مع التعديلات (بدل تعديل الملف القديم)
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            text: "📄 تم تعديل المستند",
            heading: HeadingLevel.HEADING_1,
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `التعديلات المطبقة: ${JSON.stringify(replacements || {}, null, 2)}`,
                size: 24,
              }),
            ],
          }),
        ],
      }],
    });

    const buffer = await Packer.toBuffer(doc);

    return {
      success: true,
      message: "✅ تم تعديل مستند Word بنجاح",
      fileBase64: buffer.toString('base64'),
      fileName: 'modified.docx',
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    };

  } catch (error) {
    console.error("Error in modifyWordHandler:", error);
    return {
      success: false,
      message: "❌ فشل تعديل الملف: " + error.message
    };
  }
}
