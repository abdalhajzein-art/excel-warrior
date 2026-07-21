// api/chat.js
import { SYSTEM_PROMPT } from "./agent/system.js";
import { toolsDefinition, toolsRegistry } from "./tools/index.js";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ reply: `Method ${req.method} Not Allowed` });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { message, excelJSON } = body || {};

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ reply: "⚠️ خطأ: مفتاح GEMINI_API_KEY غير مضاف في متغيرات البيئة على Railway." });
    }

    let userContent = message || "تعديل الملف المرفق";

    // تحويل الأدوات بتنسيق يفهمه جوجل (Gemini Function Declarations) إذا لزم الأمر، 
    // أو سنرسل الطلب مباشرة لنظام جوجل الرسمي.
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: `${SYSTEM_PROMPT}\n\nUser Request: ${userContent}` }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.5
        }
      })
    });

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message || "خطأ غير معروف من خوادم جوجل");
    }

    const candidate = data.candidates?.[0];
    const replyText = candidate?.content?.parts?.[0]?.text || "تم الاستلام بنجاح ولكن لم يتم إرجاع رد نصي.";

    return res.status(200).json({ reply: replyText });

  } catch (error) {
    console.error("Error in Gemini Chat API:", error);
    return res.status(500).json({ reply: "⚠️ خطأ في المعالجة التقنية مع جوجل: " + error.message });
  }
}
