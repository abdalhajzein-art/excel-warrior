import { GoogleGenerativeAI } from "@google/generative-ai";

// إعدادات الـ API
export const config = {
  api: {
    bodyParser: true, // تفعيل قارئ الجسم التلقائي لتسهيل التعامل مع الـ JSON
  },
};

export default async function handler(req, res) {
  // إعدادات الـ CORS للسماح بالاتصال من واجهتك
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // معالجة طلبات الـ OPTIONS (لـ CORS)
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // السماح فقط بطلبات POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Only POST is accepted." });
  }

  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "No message provided." });
    }

    // التحقق من وجود مفتاح الـ API
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "API Key is not configured on the server." });
    }

    // الاتصال بـ Gemini
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // استخدام نموذج Flash لأنه سريع، مجاني للمطورين، وممتاز للمحادثات
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // إرسال الطلب
    const result = await model.generateContent(message);
    const response = await result.response;
    const text = response.text();

    // إرجاع الرد للواجهة
    return res.status(200).json({ reply: text });

  } catch (error) {
    console.error("Error connecting to Gemini:", error);
    return res.status(500).json({
      error: "Failed to get response from AI.",
      details: error.message,
    });
  }
}
