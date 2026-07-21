// api/word/modify.js
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

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

    // تحويل Base64 إلى Buffer
    const content = Buffer.from(base64, "base64");
    
    // فتح الملف كملف مضغوط (هيكلية ملفات الوورد)
    const zip = new PizZip(content);
    
    // تهيئة القالب والمعالجة
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    // حقن التعديلات والاستبدالات
    doc.render(replacements);

    // استخراج الملف المعدل النهائي
    const outputBuffer = doc.getZip().generate({
      type: "nodebuffer",
      compression: "DEFLATE",
    });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", "attachment; filename=modified.docx");

    return res.status(200).send(Buffer.from(outputBuffer));

  } catch (error) {
    console.error("خطأ أثناء تعديل الوورد:", error);
    return res.status(500).json({ error: "خطأ أثناء تعديل الملف: " + error.message });
  }
}

export async function modifyWordHandler(payload) {
  return { status: "success", message: "تم تعديل الوورد بنجاح" };
}

