export async function generateImageHandler(req, res) {
  try {
    const { prompt } = req.body || {};

    if (!prompt) {
      return { 
        success: false, 
        error: "الوصف مطلوب لتوليد الصورة." 
      };
    }

    // ✅ نستخدم Groq API (إذا كان متوفراً)
    // ملاحظة: Groq ما يدعم توليد الصور حالياً، لكن بنحاول مع Gemini كخيار ثانوي
    const apiKey = process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      return { 
        success: false, 
        error: "مفتاح API غير متوفر. يرجى إضافة GROQ_API_KEY أو GEMINI_API_KEY." 
      };
    }

    // ✅ أولاً نحاول مع Gemini Imagen (إذا كان المفتاح Gemini)
    if (apiKey === process.env.GEMINI_API_KEY) {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            instances: [{ prompt: prompt }],
            parameters: {
              sampleCount: 1,
              aspectRatio: "1:1",
              outputMimeType: "image/jpeg"
            }
          })
        });

        const data = await response.json();

        if (data.error) {
          throw new Error(data.error.message || "خطأ من خوادم توليد الصور.");
        }

        const base64Image = data.predictions?.[0]?.bytesBase64Encoded;

        if (!base64Image) {
          throw new Error("لم يتم إرجاع بيانات الصورة بشكل صحيح.");
        }

        return {
          success: true,
          message: "✨ أبشر، تم توليد الصورة بنجاح.",
          fileBase64: base64Image,
          fileName: `alatheer_image_${Date.now()}.jpg`,
          contentType: "image/jpeg"
        };

      } catch (geminiErr) {
        console.error("Gemini Image Generation Error:", geminiErr);
        // نكمل للخيار الثاني
      }
    }

    // ✅ الخيار الثاني: استخدام Groq مع نموذج وهمي (مؤقتاً)
    // ملاحظة: Groq ما يدعم توليد الصور، نرجع رسالة توضيحية
    return {
      success: false,
      error: "توليد الصور غير متوفر حالياً مع Groq. يرجى استخدام مفتاح Gemini لتوليد الصور."
    };

  } catch (error) {
    console.error("Error in generateImageHandler:", error);
    return {
      success: false,
      error: "حدث خطأ أثناء توليد الصورة: " + error.message
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
    const result = await generateImageHandler({ body });

    if (result.success && result.fileBase64) {
      res.setHeader("Content-Type", result.contentType || "image/jpeg");
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(result.fileName)}"`);
      
      // نرسل الصورة كـ Base64
      return res.status(200).json({
        reply: result.message,
        fileBase64: result.fileBase64,
        fileName: result.fileName,
        contentType: result.contentType
      });
    }

    return res.status(400).json({ error: result.error || "فشل توليد الصورة" });

  } catch (err) {
    console.error("Error in image generate route:", err);
    return res.status(500).json({ error: "خطأ في التوليد: " + err.message });
  }
}
