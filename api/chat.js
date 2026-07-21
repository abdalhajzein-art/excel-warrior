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
    const { message, excelJSON } = body || {}; // استقبال الملف أو بياناته المرفقة خلف الكواليس

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ reply: "⚠️ خطأ: مفتاح GROQ_API_KEY غير مضاف في متغيرات البيئة." });
    }

    let userContent = message || "تعديل الملف المرفق";

    // إرسال الأمر النصي فقط للذكاء الاصطناعي (بدون حشر الملف لتجنب التوكنز)
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

    // إذا طلب النموذج تنفيذ أداة
    if (messageContent.tool_calls && messageContent.tool_calls.length > 0) {
      const toolCall = messageContent.tool_calls[0];
      const toolName = toolCall.function.name;
      let toolPayload = JSON.parse(toolCall.function.arguments);

      // إذا كانت الأداة تتعلق بالإكسل والمستخدم أرفق ملفاً (Base64)، ندمجه تلقائياً في الباي لود
      if (toolName.includes('excel') && excelJSON && excelJSON[0] && excelJSON[0].fileBase64) {
        toolPayload.base64 = excelJSON[0].fileBase64;
      }

      if (toolsRegistry[toolName]) {
        const toolResult = await toolsRegistry[toolName].handler(toolPayload);
        
        // إذا كان الناتج ملف جاهز للتحميل (Buffer)
        if (Buffer.isBuffer(toolResult) || toolResult instanceof Uint8Array) {
          return res.status(200).json({
            reply: "✅ تم تنفيذ التعديل بنجاح وجاهز للتحميل:",
            fileBase64: Buffer.from(toolResult).toString('base64'),
            fileName: 'modified.xlsx'
          });
        }

        return res.status(200).json({ reply: "✅ تم تنفيذ الطلب بنجاح: " + JSON.stringify(toolResult) });
      }
    }

    return res.status(200).json({ reply: messageContent.content });

  } catch (error) {
    console.error("Error in Chat API:", error);
    return res.status(500).json({ reply: "⚠️ خطأ في المعالجة التقنية: " + error.message });
  }
}
