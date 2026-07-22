import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { SYSTEM_PROMPT } from "./api/agent/system.js";
// ✅ علق الأدوات مؤقتاً
// import { toolsDefinition, toolsRegistry } from "./api/tools/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(__dirname));

// ✅ التصحيح 1: إضافة المفتاح
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

app.post('/api/chat', async (req, res) => {
  const start = Date.now();
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { message, excelJSON } = body || {};

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ reply: "⚠️ مفتاح GEMINI_API_KEY غير متوفر." });
    }

    let userContent = message || "مرحبا";
    let fileInfoText = "";

    if (excelJSON && excelJSON[0]) {
      fileInfoText = `\n[ملف مرفق: ${excelJSON[0].fileName}]`;
    }

    // ✅ التصحيح 2: نموذج صحيح
    // ✅ التصحيح 3: إزالة الأدوات
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: `${SYSTEM_PROMPT}\n${fileInfoText}\n\nالمستخدم: ${userContent}`,
      config: {
        temperature: 0.5,
        maxOutputTokens: 150
      }
    });

    const replyText = response.text || "تم الاستلام";

    console.log(`⏱️ الرد بعد ${Date.now() - start}ms`);
    res.json({ reply: replyText });

  } catch (error) {
    console.error("❌ Error:", error);
    res.status(500).json({ reply: "⚠️ خطأ: " + error.message });
  }
});

app.post('/api/upload', (req, res) => {
  res.json({ status: "success", message: "تم استقبال الملف" });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
