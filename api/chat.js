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
    // قراءة البيانات المرسلة من الواجهة الأمامية بشكل متوافق تماماً مع Vercel
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { message, excelJSON } = body || {};

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ reply: "⚠️ خطأ: مفتاح GROQ_API_KEY غير مضاف في متغيرات البيئة على Vercel." });
    }

    let userContent = message || "";
    if (excelJSON && excelJSON.length > 0) {
      userContent += "\n\n[بيانات الملف المرفقة]: " + JSON.stringify(excelJSON);
    }

    // إرسال الطلب إلى نموذج Groq القوي
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
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

    // إذا كان النموذج يريد استدعاء أداة (Tools)
    if (messageContent.tool_calls) {
      return res.status(200).json({ 
        reply: "تم استدعاء الأداة بنجاح والتنفيذ قيد الإجراء...", 
        tool_calls: messageContent.tool_calls 
      });
    }

    // الرد العادي المباشر
    return res.status(200).json({ reply: messageContent.content });

  } catch (error) {
    console.error("Error in Vercel Chat API:", error);
    return res.status(500).json({ reply: "⚠️ خطأ في المعالجة التقنية: " + error.message });
  }
}
