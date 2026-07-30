/**
 * api/tools/ppt.js – Sovereign PowerPoint Engine (Final Edition)
 * محرك إنشاء العروض التقديمية (.pptx) بدون أي ذكاء لغوي
 */

import fs from "fs";
import pptxgen from "pptxgenjs";
import { safeTempFile, safeUnlink } from "./helpers.js";

/**
 * إنشاء عرض تقديمي من نص منسق
 * يفصل الشرائح عبر ---
 * يفصل العنوان عن المحتوى عبر الأسطر
 */
export async function pptCreate(textContent) {
  const outPath = safeTempFile("pptx");

  try {
    const pptx = new pptxgen();
    pptx.rtl = true;

    // تنظيف النص
    const rawSlides = textContent
      .split("---")
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (rawSlides.length === 0) {
      throw new Error("⚠️ لا يوجد أي شريحة صالحة في النص.");
    }

    rawSlides.forEach((slideContent, index) => {
      const slide = pptx.addSlide();

      // تقسيم الأسطر
      const lines = slideContent
        .split("\n")
        .map(l => l.trim())
        .filter(l => l.length > 0);

      // عنوان الشريحة
      const title = lines[0] || `شريحة ${index + 1}`;

      slide.addText(title.slice(0, 120), {
        x: 0.5,
        y: 0.8,
        w: "90%",
        fontSize: 26,
        bold: true,
        align: "right",
        color: "1F4E78"
      });

      // محتوى الشريحة
      if (lines.length > 1) {
        const body = lines.slice(1).join("\n").slice(0, 2000);

        slide.addText(body, {
          x: 0.5,
          y: 2.0,
          w: "90%",
          fontSize: 18,
          align: "right",
          color: "333333"
        });
      }
    });

    await pptx.writeFile({ fileName: outPath });

    const buffer = fs.readFileSync(outPath);

    return {
      fileBase64: buffer.toString("base64"),
      fileName: `presentation_${Date.now()}.pptx`
    };
  } catch (err) {
    console.error("🔥 PPTCreate Error:", err);
    throw new Error(`⚠️ فشل إنشاء عرض PowerPoint: ${err.message}`);
  } finally {
    safeUnlink(outPath);
  }
}