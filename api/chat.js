import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ reply: "Method not allowed" });

  try {
    const { message } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) return res.status(500).json({ reply: "مفتاح API مفقود" });

    const genAI = new GoogleGenerativeAI(apiKey);
    
    // استخدم هذا النموذج تحديداً لأنه الأكثر دعماً في 2026
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContent(message);
    return res.status(200).json({ reply: result.response.text() });

  } catch (error) {
    // هذا السطر سيكشف لنا الحقيقة إذا فشل الاتصال مرة أخرى
    return res.status(500).json({ reply: "خطأ: " + error.message });
  }
}
