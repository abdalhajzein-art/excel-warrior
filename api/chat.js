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
    
    // التحقق من المفتاح
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ reply: "خطأ: مفتاح الـ API غير مهيأ في السيرفر." });
    }

    if (!message) return res.status(400).json({ reply: "الرسالة فارغة، يرجى كتابة شيء." });

    // إعداد النموذج المضمون والمستقر
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    // طلب الرد من الذكاء الاصطناعي
    const result = await model.generateContent(message);
    const response = await result.response;
    const text = response.text();

    return res.status(200).json({ reply: text });

  } catch (error) {
    console.error("خطأ تقني:", error);
    return res.status(500).json({ 
      reply: "حدث خطأ أثناء الاتصال بالذكاء الاصطناعي. تأكد من إعدادات المفتاح." 
    });
  }
}
