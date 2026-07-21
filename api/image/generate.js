// /api/image/generate.js
export async function generateImageHandler(req, res) {
  try {
    const { prompt } = req.body || {};

    if (!prompt) {
      return res.status(400).json({ 
        success: false, 
        error: "الوصف مطلوب لتوليد الصورة." 
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ success: false, error: "مفتاح API غير متوفر." });
    }

    // استدعاء نموذج توليد الصور المعتمد من جوجل (Imagen 3 أو ما يوافقه)
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [{ prompt: prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: "1:1", // يمكن تعديلها حسب الطلب (16:9 أو 1:1)
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

    return res.status(200).json({
      success: true,
      message: "✨ أبشر، تم توليد الصورة بسلامة ورونق تام:",
      fileBase64: base64Image,
      fileName: `alatheer_image_${Date.now()}.jpg`,
      contentType: "image/jpeg"
    });

  } catch (error) {
    console.error("Error in generateImageHandler:", error);
    return res.status(500).json({ 
      success: false, 
      error: "حدث خطأ أثناء توليد الصورة: " + error.message 
    });
  }
}

