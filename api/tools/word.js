/**
 * api/tools/word.js – Sovereign Word Engine (Final Edition)
 * محرك إنشاء مستندات Word (.docx) بدون أي ذكاء لغوي
 */

import { Document, Packer, Paragraph, TextRun, AlignmentType } from "docx";

/**
 * إنشاء مستند Word من نص منسق
 * - يدعم العناوين (# أو ==)
 * - يدعم الفقرات
 * - يدعم العربية ومحاذاة RTL
 */
export async function wordCreate(textContent) {
  try {
    // تنظيف النص ومنع الانفجار
    const safeText = textContent.toString().slice(0, 5000);

    const lines = safeText
      .split("\n")
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (lines.length === 0) {
      throw new Error("⚠️ لا يوجد نص صالح لإنشاء مستند Word.");
    }

    const paragraphs = lines.map((line) => {
      const isHeader =
        line.startsWith("#") ||
        line.startsWith("==") ||
        line.startsWith("##");

      const cleanLine = line.replace(/^[#=*-\s]+/, "");

      return new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new TextRun({
            text: cleanLine,
            bold: isHeader,
            size: isHeader ? 30 : 24,
            font: "Arial"
          })
        ]
      });
    });

    const doc = new Document({
      sections: [
        {
          properties: {
            rtl: true
          },
          children: paragraphs
        }
      ]
    });

    const buffer = await Packer.toBuffer(doc);

    return {
      fileBase64: buffer.toString("base64"),
      fileName: `document_${Date.now()}.docx`
    };
  } catch (err) {
    console.error("🔥 WordCreate Error:", err);
    throw new Error(`⚠️ فشل إنشاء مستند Word: ${err.message}`);
  }
}