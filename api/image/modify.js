import sharp from 'sharp';

export async function modifyImageHandler(req, res) {
  try {
    const { base64, instruction } = req.body || {};

    if (!base64 || !instruction) {
      return { 
        success: false, 
        error: "الصورة والتعليمات مطلوبتان لتنفيذ التعديل." 
      };
    }

    // ✅ تحويل Base64 إلى Buffer
    const imageBuffer = Buffer.from(base64, 'base64');
    let processedImage = sharp(imageBuffer);

    // ✅ تحليل التعليمات لتحديد نوع التعديل
    const lowerInstruction = instruction.toLowerCase();
    let resultMessage = "✨ تم تطبيق التعديلات التالية: ";

    // 1) تغيير الحجم (Resize)
    if (lowerInstruction.includes('حجم') || lowerInstruction.includes('تصغير') || lowerInstruction.includes('تكبير')) {
      // استخراج الأبعاد من التعليمات (مثال: "200x200" أو "عرض 300")
      const widthMatch = instruction.match(/(\d+)\s*[x×]\s*(\d+)/);
      if (widthMatch) {
        const width = parseInt(widthMatch[1]);
        const height = parseInt(widthMatch[2]);
        processedImage = processedImage.resize(width, height);
        resultMessage += `تغيير الحجم إلى ${width}x${height}، `;
      } else {
        // تغيير الحجم بنسبة مئوية
        const percentMatch = instruction.match(/(\d+)%/);
        if (percentMatch) {
          const percent = parseInt(percentMatch[1]) / 100;
          const metadata = await sharp(imageBuffer).metadata();
          const newWidth = Math.round(metadata.width * percent);
          const newHeight = Math.round(metadata.height * percent);
          processedImage = processedImage.resize(newWidth, newHeight);
          resultMessage += `تغيير الحجم بنسبة ${percentMatch[1]}%، `;
        }
      }
    }

    // 2) تحويل إلى أبيض وأسود (Grayscale)
    if (lowerInstruction.includes('أبيض وأسود') || lowerInstruction.includes('grayscale') || lowerInstruction.includes('black and white')) {
      processedImage = processedImage.grayscale();
      resultMessage += "تحويل إلى أبيض وأسود، ";
    }

    // 3) تغيير التنسيق (Format)
    let outputFormat = 'jpeg';
    if (lowerInstruction.includes('png')) {
      outputFormat = 'png';
      resultMessage += "تحويل إلى PNG، ";
    } else if (lowerInstruction.includes('webp')) {
      outputFormat = 'webp';
      resultMessage += "تحويل إلى WebP، ";
    } else if (lowerInstruction.includes('jpeg') || lowerInstruction.includes('jpg')) {
      outputFormat = 'jpeg';
      resultMessage += "تحويل إلى JPEG، ";
    }

    // 4) تدوير الصورة (Rotate)
    if (lowerInstruction.includes('تدوير') || lowerInstruction.includes('rotate')) {
      const angleMatch = instruction.match(/(\d+)\s*(درجة|°)/);
      if (angleMatch) {
        const angle = parseInt(angleMatch[1]);
        processedImage = processedImage.rotate(angle);
        resultMessage += `تدوير ${angle} درجة، `;
      }
    }

    // 5) تطبيق فلتر (Blur)
    if (lowerInstruction.includes('ضباب') || lowerInstruction.includes('blur')) {
      processedImage = processedImage.blur(3);
      resultMessage += "تطبيق تأثير الضباب، ";
    }

    // ✅ تنفيذ المعالجة
    const outputBuffer = await processedImage.toBuffer();

    // ✅ تحديد نوع المحتوى
    let contentType = 'image/jpeg';
    if (outputFormat === 'png') contentType = 'image/png';
    else if (outputFormat === 'webp') contentType = 'image/webp';

    return {
      success: true,
      message: resultMessage.replace(/, $/, '') + '.',
      fileBase64: outputBuffer.toString('base64'),
      fileName: `modified_${Date.now()}.${outputFormat === 'jpeg' ? 'jpg' : outputFormat}`,
      contentType: contentType
    };

  } catch (error) {
    console.error("Error in modifyImageHandler:", error);
    return {
      success: false,
      error: "حدث خطأ أثناء معالجة وتعديل الصورة: " + error.message
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
    const result = await modifyImageHandler({ body });

    if (result.success && result.fileBase64) {
      res.setHeader("Content-Type", result.contentType || "image/jpeg");
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(result.fileName)}"`);
      
      return res.status(200).json({
        reply: result.message,
        fileBase64: result.fileBase64,
        fileName: result.fileName,
        contentType: result.contentType
      });
    }

    return res.status(400).json({ error: result.error || "فشل تعديل الصورة" });

  } catch (err) {
    console.error("Error in image modify route:", err);
    return res.status(500).json({ error: "خطأ في التعديل: " + err.message });
  }
      }
