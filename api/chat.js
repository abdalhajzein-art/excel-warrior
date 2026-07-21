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

    // الاستدعاء عبر الإصدار المستقر v1 والنموذج القياسي
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

          // محاكاة كينونة الـ Request و Response لتنفيذ الـ Handler بأمان تام
          let toolResult = null;
          const mockReq = { body: toolArgs };
          const mockRes = {
            status: (code) => ({
              json: (resultData) => {
                toolResult = resultData;
                return resultData;
              }
            }),
            setHeader: () => {},
            send: (data) => { toolResult = data; }
          };

          // استدعاء دالة الأداة الحقيقية
          const handlerFn = toolsRegistry[toolName].handler;
          const directResult = await handlerFn(mockReq, mockRes);
          
          if (directResult && (directResult.fileBase64 || directResult.success)) {
            toolResult = directResult;
          }

          if (Buffer.isBuffer(toolResult) || toolResult instanceof Uint8Array) {
            const isWord = toolName.includes('word');
            return res.status(200).json({
              reply: "✅ أبشر، تم تنفيذ الطلب وتوليد المستند بنجاح:",
              fileBase64: Buffer.from(toolResult).toString('base64'),
              fileName: isWord ? 'document.docx' : 'spreadsheet.xlsx'
            });
          }

          if (toolResult && toolResult.fileBase64) {
            return res.status(200).json({
              reply: toolResult.message || "✨ أبشر، تم تنفيذ العملية بنجاح:",
              fileBase64: toolResult.fileBase64,
              fileName: toolResult.fileName || 'alatheer_output.dat',
              contentType: toolResult.contentType || 'application/octet-stream'
            });
          }

          return res.status(200).json({ reply: "✅ تم تنفيذ الأداة بنجاح." });

        } catch (toolErr) {
          console.error("Tool execution error in chat:", toolErr);
          return res.status(200).json({ reply: "⚠️ حدث خطأ أثناء تنفيذ الأداة البرمجية: " + toolErr.message });
        }
      }
    }

    // الرد النصي العادي إذا لم يتم استدعاء أداة
    const replyText = parts.find(p => p.text)?.text || "تم الاستلام بنجاح.";
    return res.status(200).json({ reply: replyText });

  } catch (error) {
    console.error("Error in Gemini Chat API:", error);
    return res.status(500).json({ reply: "⚠️ خطأ في المعالجة التقنية مع جوجل: " + error.message });
  }
}

