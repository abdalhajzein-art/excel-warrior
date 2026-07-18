export default async function handler(req, res) {
  // إعدادات الـ CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ reply: "Method not allowed" });

  try {
    const { message } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ reply: "مفتاح API غير مهيأ في السيرفر." });
    }

    // استخدمنا gemini-1.0-pro لأنه الأكثر استقراراً وقبولاً في جميع الحسابات
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.0-pro:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: message }] }]
      })
    });

    const data = await response.json();

    // التحقق من وجود رد وتمريره للواجهة
    if (data.candidates && data.candidates[0].content.parts[0].text) {
      return res.status(200).json({ reply: data.candidates[0].content.parts[0].text });
    } else {
      return res.status(500).json({ 
        reply: "تعذر الحصول على رد من النموذج. تفاصيل الخطأ: " + JSON.stringify(data.error || data) 
      });
    }

  } catch (error) {
    return res.status(500).json({ reply: "خطأ في الاتصال: " + error.message });
  }
}
