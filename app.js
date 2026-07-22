import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import Groq from 'groq-sdk';
import { SYSTEM_PROMPT } from "./api/agent/system.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(__dirname));

// ✅ استخدم Groq بدل Gemini
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

app.post('/api/chat', async (req, res) => {
  const startTime = Date.now();
  try {
    const { message, excelJSON } = req.body;

    // ✅ تحويل بيانات Excel إلى نص مفهوم
    let excelText = '';
    if (excelJSON && excelJSON.length > 0) {
      excelText = `\n[ملف مرفق: ${excelJSON[0].fileName}]\nالبيانات: ${JSON.stringify(excelJSON[0].data || '')}`;
    }

    // ✅ الاتصال بـ Groq
    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `${message || "مرحبا"}\n${excelText}` }
      ],
      model: "gpt-oss-120b", // النموذج السريع
      temperature: 0.5,
      max_tokens: 256,
    });

    const reply = completion.choices[0]?.message?.content || "تم الاستلام";

    console.log(`⏱️ الرد بعد ${Date.now() - startTime}ms`);
    res.json({ reply });

  } catch (error) {
    console.error("❌ خطأ:", error);
    res.status(500).json({ reply: "⚠️ خطأ: " + error.message });
  }
});

// ✅ مسار رفع الملفات (سيتم تفعيله لاحقاً)
app.post('/api/upload', (req, res) => {
  res.json({ status: "success", message: "تم استقبال الملف" });
});

app.listen(PORT, () => {
  console.log(`🚀 الأثير شغال على المنفذ ${PORT} مع Groq`);
});
