import { GoogleGenerativeAI } from "@google/generative-ai";

export const config = {
  api: {
    bodyParser: true,
  },
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ reply: "Method not allowed" });

  try {
    const { message } = req.body;
    
    // فحص وجود المفتاح داخل السيرفر
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("خطأ: GEMINI_API_KEY غير موجود في إعدادات البيئة!");
      return res.status(500).json({ reply: "خطأ في تهيئة السيرفر (API Key missing)" });
    }

    if (!message) return res.status(400).json({ reply: "الرسالة فارغة" });

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContent(message);
    const response = await result.response;
    const text = response.text();

    return res.status(200).json({ reply: text });

  } catch (error) {
    // طباعة الخطأ الحقيقي في Log الخاص بـ Vercel
    console.error("خطأ سيرفر:", error);
    return res.status(500).json({ 
      reply: "حدث خطأ أثناء الاتصال بالذكاء الاصطناعي: " + error.message 
    });
  }
}
