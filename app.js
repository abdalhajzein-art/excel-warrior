import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch'; // لضمان عمل الـ fetch إذا كنت تستخدم إصدار Node قديم، أو استخدم الـ global fetch
import { SYSTEM_PROMPT } from "./api/agent/system.js";
import { toolsDefinition } from "./api/tools/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// دعم الـ JSON والملفات الكبيرة للإكسل
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// تقديم ملفات الواجهة من الجذر
app.use(express.static(__dirname));

// مسار الشات والذكاء الاصطناعي (API)
app.post('/.netlify/functions/chat', async (req, res) => {
  try {
    const { message, excelJSON } = req.body;
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ reply: "⚠️ مفتاح GROQ_API_KEY غير متوفر في بيئة العمل على Railway." });
    }

    // تجهيز الرسائل مع سياق الإكسل إن وجد
    let userContent = message;
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
        model: "openai/gpt-oss-120b", // الموديل الخارق الجديد
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

    // التحقق إذا كان النموذج يريد استدعاء أداة
    if (messageContent.tool_calls) {
      return res.json({ 
        reply: "تم استدعاء الأداة بنجاح عبر الموديل الخارق", 
        tool_calls: messageContent.tool_calls 
      });
    }

    res.json({ reply: messageContent.content });

  } catch (error) {
    console.error("Error in chat API:", error);
    res.status(500).json({ reply: "⚠️ خطأ في المعالجة: " + error.message });
  }
});

// مسار رفع الملفات
app.post('/api/upload', (req, res) => {
  try {
    const { filename, data } = req.body;
    // هنا يتم معالجة الملف المرفوع وتحويله لـ JSON
    // يمكنك ربطه بالمنطق الموجود لديك في مجلد api
    res.json({ status: "success", filename, data: "تم قراءة الملف بنجاح" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// تشغيل السيرفر
app.listen(PORT, () => {
  console.log(`🚀 Server is running smoothly on port ${PORT}`);
});
