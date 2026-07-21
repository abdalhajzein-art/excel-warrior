// App.js - النسخة السيادية المعتمدة حصرياً على Google Gemini API
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { SYSTEM_PROMPT } from "./api/agent/system.js";
import { toolsDefinition, toolsRegistry } from "./api/tools/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// دعم الـ JSON والملفات الكبيرة للإكسل والوورد والصور
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// تقديم ملفات الواجهة من الجذر
app.use(express.static(__dirname));

// مسار الشات والذكاء الاصطناعي السيادي عبر Gemini API
app.post(['/api/chat', '/.netlify/functions/chat'], async (req, res) => {
  try {
    const body = req.body.body ? JSON.parse(req.body.body) : req.body;
    const { message } = body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ reply: "⚠️ مفتاح GEMINI_API_KEY غير متوفر في بيئة العمل السيادية." });
    }

    let userContent = message || "تحليل الطلب المرفق";

    // تحويل صيغة الأدوات لتتطابق مع متطلبات Google Gemini API
    const formattedTools = [{
      functionDeclarations: toolsDefinition.map(t => ({
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters
      }))
    }];

    // استدعاء عقل جيميني الرسمي عبر الإصدار المستقر v1 والنموذج الصحيح
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
              { text: `${SYSTEM_PROMPT}\n\nUser Request: ${userContent}` }
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
      throw new Error(data.error.message || "خطأ من خوادم جوجل.");
    }

    const candidate = data.candidates?.[0];
    const parts = candidate?.content?.parts || [];

    // التحقق مما إذا طلب نموذج جيميني استدعاء أداة (Function Call)
    const functionCallPart = parts.find(p => p.functionCall);

    if (functionCallPart && functionCallPart.functionCall) {
      const { name: toolName, args: toolArgs } = functionCallPart.functionCall;

      if (toolsRegistry[toolName]) {
        // تنفيذ الأداة محلياً عبر الـ Handler الخاص بها
        const toolResult = await toolsRegistry[toolName].handler(toolArgs);
        
        // إذا كانت النتيجة ملف جاهز (Buffer أو Object يحتوي على بيانات الملف/الصورة)
        if (Buffer.isBuffer(toolResult) || toolResult instanceof Uint8Array) {
          const isWord = toolName.includes('word');
          return res.json({
            reply: "✅ أبشر، تم تنفيذ الطلب وتوليد المستند بنجاح:",
            fileBase64: Buffer.from(toolResult).toString('base64'),
            fileName: isWord ? 'document.docx' : 'spreadsheet.xlsx'
          });
        }

        if (toolResult && toolResult.success && toolResult.fileBase64) {
          return res.json({
            reply: toolResult.message || "✨ أبشر، تم تنفيذ العملية بنجاح:",
            fileBase64: toolResult.fileBase64,
            fileName: toolResult.fileName || 'alatheer_output.dat',
            contentType: toolResult.contentType || 'application/octet-stream'
          });
        }

        return res.json({ reply: "✅ تم تنفيذ الأداة بنجاح." });
      }
    }

    // الرد النصي العادي إذا لم يتم استدعاء أداة
    const replyText = parts.find(p => p.text)?.text || "تم الاستلام بنجاح.";
    res.json({ reply: replyText });

  } catch (error) {
    console.error("Error in Gemini chat API:", error);
    res.status(500).json({ reply: "⚠️ خطأ في المعالجة السيادية: " + error.message });
  }
});

// مسار رفع الملفات الاحتياطي
app.post('/api/upload', (req, res) => {
  res.json({ status: "success", message: "تم استقبال الملف بنجاح" });
});

// تشغيل السيرفر
app.listen(PORT, () => {
  console.log(`🚀 Alatheer AI Suite is running smoothly on port ${PORT}`);
});
