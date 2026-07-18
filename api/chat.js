import { GoogleGenerativeAI } from "@google/generative-ai";

export const config = {
  api: {
    bodyParser: true,
  },
};

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ reply: "Method not allowed" });

  try {
    const { message } = req.body;
    
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ reply: "خطأ في إعدادات السيرفر." });
    }

    if (!message) return res.status(400).json({ reply: "الرسالة فارغة." });

    const genAI = new GoogleGenerativeAI(apiKey);
    
    // التعديل النهائي: استخدام النموذج المحدث مباشرة مع تحديد الإصدار الافتراضي للمكتبة
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContent(message);
    const text = result.response.text();

    return res.status(200).json({ reply: text });

  } catch (error) {
    // سنقوم بإرجاع تفاصيل الخطأ لنتأكد من السبب
    return res.status(500).json({ 
      reply: "خطأ تقني: " + error.message 
    });
  }
}
