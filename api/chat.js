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
      return res.status(500).json({ reply: "مفتاح API غير موجود في السيرفر." });
    }

    // استخدام مسار v1 المباشر (تجاوز كل قيود المكتبات القديمة)
    const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: message }] }]
      })
    });

    const data = await response.json();

    // التحقق من وجود رد من جوجل
    if (data.candidates && data.candidates[0].content.parts[0].text) {
      return res.status(200).json({ reply: data.candidates[0].content.parts[0].text });
    } else {
      // طباعة الخطأ القادم من جوجل مباشرة لنعرف السبب
      return res.status(500).json({ reply: "خطأ من جوجل: " + JSON.stringify(data) });
    }

  } catch (error) {
    return res.status(500).json({ reply: "خطأ داخلي: " + error.message });
  }
}
