// api/chat.js
import { SYSTEM_PROMPT } from "./agent/system.js";
import { toolsDefinition } from "./tools/index.js";

export default async function handler(req, res) {
  // السماح بطلبات POST فقط
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ reply: `Method ${req.method} Not Allowed` });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { message } = body || {}; // تم إزالة excelJSON لمنع انفجار التوكنز

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ reply: "⚠️ خطأ: مفتاح GROQ_API_KEY غير مضاف في متغيرات البيئة." });
    }

    let userContent = message || "تحليل الملف المرفق";

    // إرسال الطلب النصي فقط إلى نموذج Groq بدون بيانات الإكسل الضخمة
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
 // أو النموذج المناسب لديك
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent }
        ],
        tools: toolsDefinition,
        tool_choice: "auto",
        temperature: 0.5
      })
    });

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message);
    }

    const messageContent = data.choices[0].message;

    // إذا كان النموذج يريد استدعاء أداة (Tools) مثل تعديل الإكسل
    if (messageContent.tool_calls) {
      return res.status(200).json({ 
        reply: "تم استيعاب الطلب، جاري تنفيذ التعديل برمجياً...", 
        tool_calls: messageContent.tool_calls 
      });
    }

    // الرد العادي المباشر
    return res.status(200).json({ reply: messageContent.content });

  } catch (error) {
    console.error("Error in Chat API:", error);
    return res.status(500).json({ reply: "⚠️ خطأ في المعالجة التقنية: " + error.message });
  }
}
