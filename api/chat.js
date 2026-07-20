import { SYSTEM_PROMPT } from "./agent/system.js";

export default async function handler(req, res) {
  // 1. تحويل طلب Netlify Function إلى صيغة Node.js إذا لزم الأمر
  // في Netlify Functions، req.body قد يكون نصاً (String) وليس JSON
  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (e) {
    return res.status(400).json({ reply: "⚠️ خطأ في قراءة بيانات الطلب" });
  }

  const { message, excelJSON, sessionId } = body;
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) return res.status(500).json({ reply: "⚠️ خطأ في المفتاح البرمجي." });

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: message }
        ],
        temperature: 0.5
      })
    });

    const data = await response.json();
    
    // إرسال الرد بشكل صريح للواجهة
    return {
      statusCode: 200,
      body: JSON.stringify({ reply: data.choices[0].message.content })
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ reply: "⚠️ خطأ: " + error.message })
    };
  }
}
