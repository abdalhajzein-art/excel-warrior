import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export async function generatePdfHandler(req, res) {
  try {
    const { title, content } = req.body || {};

    if (!title || !content) {
      return res.status(400).json({ success: false, error: "العنوان والمحتوى مطلوبان لتوليد الـ PDF." });
    }

    // ✅ إنشاء مستند PDF جديد
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 800]);
    const { width, height } = page.getSize();

    // ✅ إضافة الخط
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // ✅ العنوان
    const titleSize = 24;
    const titleWidth = font.widthOfTextAtSize(title, titleSize);
    page.drawText(title, {
      x: (width - titleWidth) / 2,
      y: height - 50,
      size: titleSize,
      font: font,
      color: rgb(0, 0.2, 0.5),
    });

    // ✅ المحتوى (نقسمه لأسطر)
    const contentSize = 14;
    const lines = content.split('\n');
    let yPosition = height - 100;

    for (const line of lines) {
      if (yPosition < 50) break; // نهاية الصفحة
      
      // نلف النص إذا كان طويلاً
      const words = line.split(' ');
      let currentLine = '';
      
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const testWidth = font.widthOfTextAtSize(testLine, contentSize);
        
        if (testWidth > width - 40) {
          // نرسم السطر الحالي ونبدأ سطر جديد
          page.drawText(currentLine, {
            x: 20,
            y: yPosition,
            size: contentSize,
            font: font,
            color: rgb(0.1, 0.1, 0.1),
          });
          yPosition -= 20;
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      
      // نرسم آخر سطر
      if (currentLine) {
        page.drawText(currentLine, {
          x: 20,
          y: yPosition,
          size: contentSize,
          font: font,
          color: rgb(0.1, 0.1, 0.1),
        });
        yPosition -= 20;
      }
    }

    // ✅ تحويل المستند إلى Buffer
    const pdfBytes = await pdfDoc.save();

    return {
      success: true,
      message: `✅ تم توليد PDF: ${title}`,
      fileBase64: Buffer.from(pdfBytes).toString('base64'),
      fileName: `${title}.pdf`,
      contentType: 'application/pdf'
    };

  } catch (error) {
    console.error("Error in generatePdfHandler:", error);
    return {
      success: false,
      error: "خطأ في توليد الـ PDF: " + error.message
    };
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const result = await generatePdfHandler({ body });

    if (result.success && result.fileBase64) {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(result.fileName)}"`);
      return res.status(200).send(Buffer.from(result.fileBase64, 'base64'));
    }

    return res.status(400).json({ error: result.error || "فشل توليد الملف" });

  } catch (err) {
    console.error("Error in PDF generate route:", err);
    return res.status(500).json({ error: "خطأ في التوليد: " + err.message });
  }
            }
