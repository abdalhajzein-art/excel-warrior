import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { SYSTEM_PROMPT } from "./api/agent/system.js";
import { toolsDefinition, toolsRegistry } from "./api/tools/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// دعم الـ JSON والملفات الكبيرة للإكسل والوورد
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// تقديم ملفات الواجهة من الجذر
app.use(express.static(__dirname));

// مسار الشات والذكاء الاصطناعي وتنفيذ الأدوات تلقائياً
app.post(['/api/chat', '/.netlify/functions/chat'], async (req, res) => {
  try {
    const body = req.body.body ? JSON.parse(req.body.body) : req.body;
    const { message, excelJSON } = body;
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ reply: "⚠️ مفتاح GROQ_API_KEY غير متوفر في بيئة العمل." });
    }

    let userContent = message || "";
    if (excelJSON && excelJSON.length > 0) {
      userContent += "\n\n[بيانات الإكسل المرفقة]: " + JSON.stringify(excelJSON);
    }

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

    // التحقق مما إذا طلب نموذج الذكاء الاصطناعي استدعاء أداة (Excel أو Word)
    if (messageContent.tool_calls && messageContent.tool_calls.length > 0) {
      const toolCall = messageContent.tool_calls[0];
      const toolName = toolCall.function.name;
      const toolPayload = JSON.parse(toolCall.function.arguments);

      if (toolsRegistry[toolName]) {
        // تنفيذ الأداة واستخراج النتيجة (سواء ملف أو نص)
        const toolResult = await toolsRegistry[toolName].handler(toolPayload);
        
        // إذا كانت النتيجة عبارة عن Buffer (ملف جاهز للتحميل)
        if (Buffer.isBuffer(toolResult) || toolResult instanceof Uint8Array) {
          const isWord = toolName.includes('word');
          return res.json({
            reply: "✅ تم تنفيذ الطلب وتوليد المستند بنجاح:",
            fileBase64: Buffer.from(toolResult).toString('base64'),
            fileName: isWord ? 'document.docx' : 'spreadsheet.xlsx'
          });
        }

        return res.json({ reply: "✅ تم تنفيذ الأداة بنجاح: " + JSON.stringify(toolResult) });
      }
    }

    // الرد النصي العادي إذا لم يتم استدعاء أداة
    res.json({ reply: messageContent.content });

  } catch (error) {
    console.error("Error in chat API:", error);
    res.status(500).json({ reply: "⚠️ خطأ في المعالجة: " + error.message });
  }
});

// مسار رفع الملفات الاحتياطي
app.post('/api/upload', (req, res) => {
  res.json({ status: "success", message: "تم استقبال الملف بنجاح" });
});

// تشغيل السيرفر
app.listen(PORT, () => {
  console.log(`🚀 Server is running smoothly on port ${PORT}`);
});
