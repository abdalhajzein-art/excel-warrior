// app.js - النسخة السيادية النهائية المحدثة لعام 2026
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { SYSTEM_PROMPT } from "./api/agent/system.js";
import { toolsDefinition, toolsRegistry } from "./api/tools/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(__dirname));

app.post('/api/chat', async (req, res) => {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { message, excelJSON } = body || {};
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ reply: "⚠️ مفتاح GEMINI_API_KEY غير متوفر في بيئة العمل السيادية." });
    }

    let userContent = message || "تحليل الطلب المرفق";
    let fileInfoText = "";

    if (excelJSON && excelJSON[0]) {
      fileInfoText = `\n[معلومات الملف المرفق: اسم الملف: ${excelJSON[0].fileName || 'ملف'}، الحجم: ${excelJSON[0].size || 0} بايت]`;
    }

    const formattedTools = [{
      functionDeclarations: toolsDefinition.map(t => ({
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters
      }))
    }];

    // تم التحديث إلى النموذج القياسي الحديث والأكثر توافقاً gemini-2.0-flash
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: `${SYSTEM_PROMPT}\n${fileInfoText}\n\nUser Request: ${userContent}` }]
          }
        ],
        tools: formattedTools,
        generationConfig: { temperature: 0.5 }
      })
    });

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error.message || "خطأ من خوادم جوجل.");
    }

    const candidate = data.candidates?.[0];
    const parts = candidate?.content?.parts || [];
    const functionCallPart = parts.find(p => p.functionCall);

    if (functionCallPart && functionCallPart.functionCall) {
      const { name: toolName, args: toolArgs } = functionCallPart.functionCall;
      if (toolsRegistry[toolName]) {
        if (!toolArgs.base64 && excelJSON && excelJSON[0] && excelJSON[0].fileBase64) {
          toolArgs.base64 = excelJSON[0].fileBase64;
        }

        let toolResult = null;
        const mockReq = { body: toolArgs };
        const mockRes = {
          status: (code) => ({
            json: (resultData) => { toolResult = resultData; return resultData; }
          }),
          setHeader: () => {},
          send: (data) => { toolResult = data; }
        };

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
      }
    }

    const replyText = parts.find(p => p.text)?.text || "تم الاستلام بنجاح.";
    res.json({ reply: replyText });

  } catch (error) {
    console.error("Error in Gemini chat API:", error);
    res.status(500).json({ reply: "⚠️ خطأ في المعالجة السيادية: " + error.message });
  }
});

app.post('/api/upload', (req, res) => {
  res.json({ status: "success", message: "تم استقبال الملف بنجاح" });
});

app.listen(PORT, () => {
  console.log(`🚀 Alatheer AI Suite is running smoothly on port ${PORT}`);
});
