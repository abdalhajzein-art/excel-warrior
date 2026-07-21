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

    // تحويل تعريفات الأدوات (OpenAI format) إلى صيغة تناسب هيكل الطلب أو توجيه النموذج
    // سنقوم بتمرير السياق والأدوات لنموذج جيميني عبر واجهة الـ v1beta
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
              { 
                text: `${SYSTEM_PROMPT}\n\n[ملاحظة تقنية: لديك أدوات متاحة للتعامل مع ملفات الإكسل والوورد، إذا طلب المستخدم تعديل ملف أو إنشائه، قم بتحديد الطلب بدقة أو قم بالرد بما يناسب الأداة]\n\nUser Request: ${userContent}` 
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.4
        }
      })
    });

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message || "خطأ غير معروف من خوادم جوجل");
    }

    const candidate = data.candidates?.[0];
    const replyText = candidate?.content?.parts?.[0]?.text || "تم الاستلام بنجاح.";

    // إذا كان هناك ملف إكسل مرفق والمستخدم يطلب تعديلاً، يمكننا توجيهه مباشرة لأداة excel_modify
    if (excelJSON && excelJSON[0] && excelJSON[0].fileBase64) {
      const base64Data = excelJSON[0].fileBase64;
      
      // إذا طلب المستخدم تعديلاً صريحاً أو ذكياً، نستدعي أداة التعديل تلقائياً
      if (toolsRegistry['excel_modify']) {
        try {
          const toolResult = await toolsRegistry['excel_modify'].handler({
            base64: base64Data,
            editMap: { instruction: userContent }
          });

          if (Buffer.isBuffer(toolResult) || toolResult instanceof Uint8Array) {
            return res.status(200).json({
              reply: "✅ تم معالجة وتعديل الملف بنجاح بناءً على طلبك:",
              fileBase64: Buffer.from(toolResult).toString('base64'),
              fileName: excelJSON[0].fileName || 'modified.xlsx'
            });
          }
        } catch (toolErr) {
          console.error("Tool execution error:", toolErr);
        }
      }
    }

    return res.status(200).json({ reply: replyText });

  } catch (error) {
    console.error("Error in Gemini Chat API:", error);
    return res.status(500).json({ reply: "⚠️ خطأ في المعالجة التقنية مع جوجل: " + error.message });
  }
}
