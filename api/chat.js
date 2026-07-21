// api/chat.js
import { SYSTEM_PROMPT } from "./agent/system.js";
import { toolsRegistry, toolsDefinition } from "./tools/index.js";

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
      return res.status(500).json({ reply: "⚠️ خطأ: مفتاح GEMINI_API_KEY غير مضاف في متغيرات البيئة." });
    }

    let userContent = message || "مساعدة بخصوص الملف المرفق";
    let fileInfoText = "";

    if (excelJSON && excelJSON[0]) {
      fileInfoText = `\n[معلومات الملف المرفق: اسم الملف: ${excelJSON[0].fileName || 'ملف'}، الحجم: ${excelJSON[0].size || 0} بايت]`;
    }

    // إعداد هيكل الأدوات المتوافقة مع Gemini API
    const formattedTools = [{
      functionDeclarations: toolsDefinition.map(t => ({
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters
      }))
    }];

    // تم التعديل إلى الإصدار المستقر v1 لضمان توافق النموذج تماماً
    const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
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
        tools: formattedTools,
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
    const parts = candidate?.content?.parts || [];

    // التحقق إذا كان النموذج طلب استدعاء أداة (Function Call)
    const functionCallPart = parts.find(p => p.functionCall);

    if (functionCallPart && functionCallPart.functionCall) {
      const { name: toolName, args: toolArgs } = functionCallPart.functionCall;

      if (toolsRegistry[toolName]) {
        try {
          if (!toolArgs.base64 && excelJSON && excelJSON[0] && excelJSON[0].fileBase64) {
            toolArgs.base64 = excelJSON[0].fileBase64;
          }

          const toolResult = await toolsRegistry[toolName].handler({
            body: toolArgs
          }, {
            status: (code) => ({ json: (data) => data })
          });

          if (Buffer.isBuffer(toolResult) || toolResult instanceof Uint8Array || (toolResult && toolResult.success)) {
            return res.status(200).json({
              reply: "✅ أبشر، تم تنفيذ الطلب ومعالجة الملف بنجاح:",
              fileBase64: toolResult.fileBase64 || (Buffer.isBuffer(toolResult) ? Buffer.from(toolResult).toString('base64') : undefined),
              fileName: excelJSON?.[0]?.fileName || 'processed_file.xlsx'
            });
          }

          return res.status(200).json({ reply: "✅ تم تنفيذ العملية المطلوبة بنجاح." });

        } catch (toolErr) {
          console.error("Tool execution error in chat:", toolErr);
        }
      }
    }

    const replyText = parts.find(p => p.text)?.text || "تم الاستلام بنجاح.";
    return res.status(200).json({ reply: replyText });

  } catch (error) {
    console.error("Error in Gemini Chat API:", error);
    return res.status(500).json({ reply: "⚠️ خطأ في المعالجة التقنية مع جوجل: " + error.message });
  }
}
