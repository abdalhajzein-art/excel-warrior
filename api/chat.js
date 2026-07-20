import { SYSTEM_PROMPT } from "./agent/system.js";

// تحذير: في بيئة Serverless مثل Netlify، الذاكرة تُمسح، لذا التاريخ لن يُحفظ بين الطلبات
const sessions = new Map();

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { message, excelJSON, sessionId } = req.body;
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) return res.status(500).json({ reply: "⚠️ خطأ في إعدادات السيرفر." });
    if (!sessionId || !message) return res.status(400).json({ reply: "⚠️ بيانات ناقصة." });

    // تنظيف سياق الملف (لا ترسل JSON الكامل لتجنب تجاوز حجم الطلب)
    let fileContext = "لا يوجد ملف.";
    if (excelJSON && excelJSON.length > 0) {
      fileContext = `ملف: ${excelJSON[0].filename}، عدد الشيتات: ${excelJSON[0].sheets?.length || 0}`;
    }

    // إعداد التاريخ
    if (!sessions.has(sessionId)) sessions.set(sessionId, []);
    const history = sessions.get(sessionId);

    history.push({
      role: "user",
      content: `سياق الملف: ${fileContext}\nرسالة المستخدم: ${message}`
    });

    // إرسال الطلب لـ Groq
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b", // هذا هو موديلك المفضل
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...history
        ],
        temperature: 0.4,
        max_tokens: 1024 // تحديد التوكنز يمنع الانهيار
      })
    });

    const data = await response.json();

    // التحقق من وجود خطأ في رد الـ API
    if (data.error) {
      return res.status(500).json({ reply: "⚠️ خطأ من Groq: " + data.error.message });
    }

    const aiReply = data?.choices?.[0]?.message?.content;
    
    if (!aiReply) {
      return res.status(500).json({ reply: "⚠️ لم يتم استلام رد، تأكد من أن الموديل مفعل في حسابك." });
    }

    history.push({ role: "assistant", content: aiReply });
    return res.status(200).json({ reply: aiReply });

  } catch (error) {
    return res.status(500).json({ reply: "⚠️ خطأ في الاتصال: " + error.message });
  }
}
