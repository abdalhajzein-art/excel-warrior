import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { SYSTEM_PROMPT } from "./api/agent/system.js";
import { toolsDefinition, toolsRegistry } from "./api/tools/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(__dirname));

const ai = new GoogleGenAI({});

app.post('/api/chat', async (req, res) => {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { message, excelJSON } = body || {};

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ reply: "⚠️ مفتاح GEMINI_API_KEY غير متوفر في بيئة العمل السيادية." });
    }

    let userContent = message || "";
    let fileInfoText = "";

    if (excelJSON && excelJSON[0]) {
      fileInfoText = `\n[معلومات الملف المرفق: اسم الملف: ${excelJSON[0].fileName || 'ملف'}، الحجم: ${excelJSON[0].size || 0} بايت]`;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: `${SYSTEM_PROMPT}\n${fileInfoText}\n\nUser Request: ${userContent}`,
      config: {
        temperature: 0.5,
        tools: [{
          functionDeclarations: toolsDefinition.map(t => ({
            name: t.function.name,
            description: t.function.description,
            parameters: t.function.parameters
          }))
        }]
      }
    });

    const candidate = response.candidates?.[0];
    const functionCalls = candidate?.content?.parts?.filter(p => p.functionCall) || [];

    if (functionCalls.length > 0) {
      const { name: toolName, args: toolArgs } = functionCalls[0].functionCall;
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

    const replyText = response.text || "تم الاستلام بنجاح.";
    res.json({ reply: replyText });

  } catch (error) {
    console.error("Error in Official Gemini SDK API:", error);
    res.status(500).json({ reply: "⚠️ خطأ في المعالجة السيادية الرسمية: " + error.message });
  }
});

app.post('/api/upload', (req, res) => {
  res.json({ status: "success", message: "تم استقبال الملف بنجاح" });
});

app.listen(PORT, () => {
  console.log(`🚀 Alatheer AI Suite is running smoothly on port ${PORT}`);
});
