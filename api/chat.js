// api/chat.js
import { SYSTEM_PROMPT } from "./agent/system.js";
import { toolsRegistry } from "./tools/index.js";

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

    let userContent = message || "مساعدة بخصوص الملف المرفق";
    let fileInfoText = "";

    // إذا تم إرفاق ملف إكسل، نستخرج معلوماته ليفهمها جيميني بدون أخطاء
    if (excelJSON && excelJSON[0]) {
      fileInfoText = `\n[معلومات الملف المرفق: اسم الملف: ${excelJSON[0].fileName || 'ملف'}، الحجم: ${excelJSON[0].size || 0} بايت]`;
    }

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
                text: `${SYSTEM_PROMPT}\n${fileInfoText}\n\nUser Request: ${userContent}` 
              }
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
    const replyText = candidate?.content?.parts?.[0]?.text || "تم الاستلام بنجاح.";

    // هل طلب المستخدم تعديلاً حقيقياً يتطلب تدخل أدوات الإكسل؟ (وليس مجرد قراءة أو سؤال)
    const isModificationRequest = userContent.includes("أضف") || userContent.includes("عمود") || userContent.includes("حذف") || userContent.includes("تعديل") || userContent.includes("غير");

    if (excelJSON && excelJSON[0] && excelJSON[0].fileBase64 && isModificationRequest) {
      const base64Data = excelJSON[0].fileBase64;
      
      if (toolsRegistry['excel_modify']) {
        try {
          // بناء هيكل افتراضي آمن لتجنب أخطاء الـ editMap في حال لم يحدد المستخدم عملية دقيقة
          const toolResult = await toolsRegistry['excel_modify'].handler({
            base64: base64Data,
            editMap: { operation: "none", instruction: userContent }
          });

          if (Buffer.isBuffer(toolResult) || toolResult instanceof Uint8Array) {
            return res.status(200).json({
              reply: "✅ تم معالجة الملف وإعادة تجهيزه بناءً على طلبك:",
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
